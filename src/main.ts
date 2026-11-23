import "./style.css";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { SevenPawsPet } from "./pet/sevenPaws.ts";
import { COATS } from "./pet/coats";
import type { AppSettings, CatInput } from "./types";

const isTauri = "__TAURI_INTERNALS__" in window || "__TAURI__" in window;

const stage = document.getElementById("stage") as HTMLDivElement;
const permNotice = document.getElementById("permNotice") as HTMLDivElement;
const menuEl = document.getElementById("menu") as HTMLDivElement;
const coatsEl = document.getElementById("coats") as HTMLDivElement;
const scaleSlider = document.getElementById("scaleSlider") as HTMLInputElement;
const scaleValue = document.getElementById("scaleValue") as HTMLSpanElement;
const sleepSelect = document.getElementById("sleepSelect") as HTMLSelectElement;
const layoutSelect = document.getElementById("layoutSelect") as HTMLSelectElement;
const leftMouseInput = document.getElementById("leftMouse") as HTMLInputElement;
const privacyInput = document.getElementById("privacyMode") as HTMLInputElement;
const purrPetInput = document.getElementById("purrPet") as HTMLInputElement;
const purrSleepInput = document.getElementById("purrSleep") as HTMLInputElement;
const labelsInput = document.getElementById("showKeyLabels") as HTMLInputElement;
const resetBtn = document.getElementById("resetPosBtn") as HTMLButtonElement;
const quitBtn = document.getElementById("quitBtn") as HTMLButtonElement;

const fallbackSettings: AppSettings = {
  x: null,
  y: null,
  scale: 0.6,
  alwaysOnTop: true,
  purrPet: true,
  purrSleep: false,
  autostart: false,
  privacyMode: false,
  leftMouse: false,
  coat: "tuxedo",
  sleepMinutes: 5,
  showKeyLabels: true,
  keyboardLayout: "65",
};

let settings: AppSettings = { ...fallbackSettings };
let scene: SevenPawsPet;
let menuVisible = false;

function menuButtonSelected(coatId: string) {
  for (const btn of coatsEl.querySelectorAll<HTMLButtonElement>(".coat-btn")) {
    btn.setAttribute("aria-pressed", String(btn.dataset.coat === coatId));
  }
}

function buildCoatButtons() {
  coatsEl.innerHTML = "";
  for (const coat of COATS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "coat-btn";
    btn.dataset.coat = coat.id;
    const swatch = coat.pattern === "calico"
      ? `linear-gradient(135deg, ${coat.fur} 52%, ${coat.patchA ?? "#e9973f"} 52%)`
      : coat.pattern === "tabby"
        ? `linear-gradient(180deg, ${coat.fur} 62%, ${coat.stripe ?? coat.fur} 62%)`
        : coat.fur;
    btn.innerHTML = `<span class="coat-swatch" style="background:${swatch}"></span><span>${coat.name}</span>`;
    btn.addEventListener("click", () => {
      if (settings.coat === coat.id) return;
      void saveSettings({ coat: coat.id });
    });
    coatsEl.appendChild(btn);
  }
}

function syncControls() {
  scaleSlider.value = String(Math.round(settings.scale * 100));
  scaleValue.textContent = `${Math.round(settings.scale * 100)}%`;
  sleepSelect.value = String(settings.sleepMinutes);
  layoutSelect.value = settings.keyboardLayout;
  leftMouseInput.checked = settings.leftMouse;
  privacyInput.checked = settings.privacyMode;
  purrPetInput.checked = settings.purrPet;
  purrSleepInput.checked = settings.purrSleep;
  labelsInput.checked = settings.showKeyLabels;
  menuButtonSelected(settings.coat);
}

async function saveSettings(patch: Partial<AppSettings>) {
  const next = { ...settings, ...patch };
  settings = next;
  scene.applySettings(next);
  syncControls();
  if (!isTauri) return;
  try {
    const saved = await invoke<AppSettings>("update_settings", { patch: next });
    settings = saved;
    scene.applySettings(saved);
    syncControls();
  } catch {
    // Keep the local state; the next save retries.
  }
}

function setMenuOpen(open: boolean) {
  menuVisible = open;
  menuEl.classList.toggle("hidden", !open);
  if (isTauri) void invoke("set_menu_open", { open });
}

function updateMenuScroll() {
  const scrollEl = menuEl.querySelector<HTMLElement>(".menu-scroll");
  if (!scrollEl) return;
  scrollEl.classList.toggle("has-scroll", scrollEl.scrollHeight > scrollEl.clientHeight + 1);
}

function positionMenu(x = menuEl.offsetLeft, y = menuEl.offsetTop) {
  updateMenuScroll();
  const vw = stage.clientWidth || window.innerWidth;
  const vh = stage.clientHeight || window.innerHeight;
  const rect = menuEl.getBoundingClientRect();
  const left = Math.max(6, Math.min(x, vw - rect.width - 6));
  const top = Math.max(6, Math.min(y, vh - rect.height - 6));
  menuEl.style.left = `${left}px`;
  menuEl.style.top = `${top}px`;
}

function showMenu(x: number, y: number) {
  setMenuOpen(true);
  requestAnimationFrame(() => positionMenu(x, y));
}

function hideMenu() {
  if (menuVisible) setMenuOpen(false);
}

function bindMenu() {
  document.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    if (menuEl.contains(e.target as Node)) return;
    showMenu(e.clientX, e.clientY);
  });

  document.addEventListener("pointerdown", (e) => {
    if (menuVisible && !menuEl.contains(e.target as Node)) hideMenu();
  });

  menuEl.addEventListener("pointerdown", (e) => e.stopPropagation());
  menuEl.addEventListener("click", (e) => e.stopPropagation());
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hideMenu();
  });

  scaleSlider.addEventListener("input", () => {
    const pct = Number(scaleSlider.value);
    scaleValue.textContent = `${pct}%`;
  });

  scaleSlider.addEventListener("change", () => {
    void saveSettings({ scale: Number(scaleSlider.value) / 100 });
  });

  sleepSelect.addEventListener("change", () => {
    void saveSettings({ sleepMinutes: Number(sleepSelect.value) });
  });

  layoutSelect.addEventListener("change", () => {
    void saveSettings({ keyboardLayout: layoutSelect.value === "104" ? "104" : "65" });
  });

  leftMouseInput.addEventListener("change", () => {
    void saveSettings({ leftMouse: leftMouseInput.checked });
  });
  privacyInput.addEventListener("change", () => {
    void saveSettings({ privacyMode: privacyInput.checked });
  });
  purrPetInput.addEventListener("change", () => {
    void saveSettings({ purrPet: purrPetInput.checked });
  });
  purrSleepInput.addEventListener("change", () => {
    void saveSettings({ purrSleep: purrSleepInput.checked });
  });
  labelsInput.addEventListener("change", () => {
    void saveSettings({ showKeyLabels: labelsInput.checked });
  });

  resetBtn.addEventListener("click", async () => {
    hideMenu();
    if (!isTauri) return;
    await invoke("reset_position");
  });

  quitBtn.addEventListener("click", async () => {
    if (!isTauri) return;
    await invoke("quit_app");
  });
}

function bindPointer() {
  const canvas = stage.querySelector("canvas");
  if (!canvas) return;

  canvas.addEventListener("pointerdown", async (e) => {
    if (menuVisible) {
      hideMenu();
      return;
    }
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
      settings = { ...fallbackSettings };
    }
  }

  const params = new URLSearchParams(location.search);
  const debugCoat = params.get("previewCoat");
  if (debugCoat && COATS.some((c) => c.id === debugCoat)) settings.coat = debugCoat;

  scene = new SevenPawsPet(stage, settings, (regions) => {
    if (isTauri) void invoke("set_hit_regions", { regions });
  });

  buildCoatButtons();
  bindMenu();
  bindPointer();
  syncControls();
  listenGlobalKeysForDev();

  if (isTauri) {
    await listen<CatInput>("cat-input", (ev) => scene.handleInput(ev.payload));
    await listen<AppSettings>("cat-settings", (ev) => {
      settings = ev.payload;
      scene.applySettings(settings);
      syncControls();
    });
    await listen("cat-open-menu", () => {
      showMenu(window.innerWidth * 0.55, window.innerHeight * 0.08);
    });
    await listen<{ trusted: boolean }>("cat-input-status", (ev) => {
      permNotice.classList.toggle("hidden", ev.payload.trusted);
    });
  }

  window.addEventListener("resize", () => {
    if (menuVisible) positionMenu();
    if (isTauri) void invoke("set_hit_regions", { regions: scene.hitRegions() });
  });

  if (params.get("demo") === "1") runDemo();
  if (!isTauri) (window as unknown as { __pet: SevenPawsPet }).__pet = scene;
  if (isTauri) void invoke("set_hit_regions", { regions: scene.hitRegions() });
}

void boot();
