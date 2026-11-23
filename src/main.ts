import "./style.css";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { SevenPawsPet } from "./pet/sevenPaws.ts";
import { COATS } from "./pet/coats";
import { defaultSettings } from "./defaults";
import type { AppSettings, CatInput, CustomCat } from "./types";

const isTauri = "__TAURI_INTERNALS__" in window || "__TAURI__" in window;

const stage = document.getElementById("stage") as HTMLDivElement;
const permNotice = document.getElementById("permNotice") as HTMLDivElement;

let settings: AppSettings = { ...defaultSettings };
let customCats: CustomCat[] = [];
let scene: SevenPawsPet;

function bindPointer() {
  const canvas = stage.querySelector("canvas");
  if (!canvas) return;

  canvas.addEventListener("pointerdown", async (e) => {
    if (e.button !== 0) return;
    if (scene.pickHead(e.clientX, e.clientY)) return;

    if (!isTauri) return;
    try {
      await invoke("set_dragging", { dragging: true });
      await getCurrentWindow().startDragging();
    } catch {
      // The window position watcher persists the final position.
    } finally {
      await invoke("set_dragging", { dragging: false });
    }
  });

  canvas.addEventListener("pointermove", (e) => {
    canvas.style.cursor = scene.pickHead(e.clientX, e.clientY) ? "pointer" : "default";
  });
}

function listenGlobalKeysForDev() {
  if (!new URLSearchParams(location.search).has("localinput")) return;
  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    scene.handleInput({ kind: "keyDown", code: e.code, repeat: false });
  });
  window.addEventListener("keyup", (e) => {
    scene.handleInput({ kind: "keyUp", code: e.code });
  });
}

function runDemo() {
  const script = ["KeyH", "KeyE", "KeyL", "KeyL", "KeyO", "Space", "KeyC", "KeyA", "KeyT"];
  let step = 0;
  const type = () => {
    const code = script[step++ % script.length];
    scene.handleInput({ kind: "keyDown", code, repeat: false });
    window.setTimeout(() => scene.handleInput({ kind: "keyUp", code }), 100);
    window.setTimeout(type, step % script.length === 0 ? 1800 : 240);
  };
  window.setTimeout(type, 500);
}

async function boot() {
  if (!isTauri) {
    document.documentElement.style.background = "#f6d97a";
    document.body.style.position = "relative";
    document.body.style.width = "660px";
    document.body.style.height = "480px";
    document.body.style.margin = "0";
    document.body.style.boxShadow = "inset 0 0 0 1px rgba(0,0,0,0.35)";
  }

  if (isTauri) {
    try {
      settings = await invoke<AppSettings>("get_settings");
    } catch {
      settings = { ...defaultSettings };
    }
    try {
      customCats = await invoke<CustomCat[]>("get_custom_cats");
    } catch {
      customCats = [];
    }
  }

  const params = new URLSearchParams(location.search);
  const debugCoat = params.get("previewCoat");
  if (debugCoat && COATS.some((c) => c.id === debugCoat)) settings.coat = debugCoat;

  scene = new SevenPawsPet(stage, settings, customCats, (regions) => {
    if (isTauri) void invoke("set_hit_regions", { regions });
  });

  bindPointer();
  listenGlobalKeysForDev();

  document.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    if (isTauri) {
      void invoke("open_settings");
    } else {
      window.open("settings.html", "_blank", "width=268,height=540");
    }
  });

  if (isTauri) {
    await listen<CatInput>("cat-input", (ev) => scene.handleInput(ev.payload));
    await listen<AppSettings>("cat-settings", (ev) => {
      settings = ev.payload;
      scene.applySettings(settings, customCats);
    });
    await listen<CustomCat[]>("cat-cats", (ev) => {
      customCats = ev.payload;
      scene.applySettings(settings, customCats);
    });
    await listen<{ trusted: boolean }>("cat-input-status", (ev) => {
      permNotice.classList.toggle("hidden", ev.payload.trusted);
    });
  }

  window.addEventListener("resize", () => {
    scene.refreshHitRegions();
  });

  if (params.get("demo") === "1") runDemo();
  if (!isTauri) (window as unknown as { __pet: SevenPawsPet }).__pet = scene;
  scene.refreshHitRegions();
}

void boot();