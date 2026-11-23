import "./style.css";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { COATS } from "./pet/coats";
import { defaultSettings } from "./defaults";
import type { AppSettings } from "./types";

const isTauri = "__TAURI_INTERNALS__" in window || "__TAURI__" in window;

const menuEl = document.getElementById("menu") as HTMLDivElement;
const coatsEl = document.getElementById("coats") as HTMLDivElement;
const scaleSlider = document.getElementById("scaleSlider") as HTMLInputElement;
const scaleValue = document.getElementById("scaleValue") as HTMLSpanElement;
const sleepSelect = document.getElementById("sleepSelect") as HTMLSelectElement;
const layoutSelect = document.getElementById("layoutSelect") as HTMLSelectElement;
const leftMouseInput = document.getElementById("leftMouse") as HTMLInputElement;
const clickThroughLockedInput = document.getElementById("clickThroughLocked") as HTMLInputElement;
const privacyInput = document.getElementById("privacyMode") as HTMLInputElement;
const purrPetInput = document.getElementById("purrPet") as HTMLInputElement;
const purrSleepInput = document.getElementById("purrSleep") as HTMLInputElement;
const labelsInput = document.getElementById("showKeyLabels") as HTMLInputElement;
const resetBtn = document.getElementById("resetPosBtn") as HTMLButtonElement;
const quitBtn = document.getElementById("quitBtn") as HTMLButtonElement;
const closeBtn = document.getElementById("closeBtn") as HTMLButtonElement;

let settings: AppSettings = { ...defaultSettings };
let hideTimer = 0;

function hide() {
  window.clearTimeout(hideTimer);
  if (isTauri) {
    void getCurrentWindow().hide();
  } else {
    window.close();
  }
}

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
  clickThroughLockedInput.checked = settings.clickThroughLocked;
  privacyInput.checked = settings.privacyMode;
  purrPetInput.checked = settings.purrPet;
  purrSleepInput.checked = settings.purrSleep;
  labelsInput.checked = settings.showKeyLabels;
  menuButtonSelected(settings.coat);
  requestAnimationFrame(updateMenuScroll);
}

function updateMenuScroll() {
  const scrollEl = menuEl.querySelector<HTMLElement>(".menu-scroll");
  if (!scrollEl) return;
  scrollEl.classList.toggle("has-scroll", scrollEl.scrollHeight > scrollEl.clientHeight + 1);
}

async function saveSettings(patch: Partial<AppSettings>) {
  const next = { ...settings, ...patch };
  settings = next;
  syncControls();
  if (!isTauri) return;
  try {
    const saved = await invoke<AppSettings>("update_settings", { patch: next });
    settings = saved;
    syncControls();
  } catch {
    // Keep the local state; the next save retries.
  }
}

async function refresh() {
  if (isTauri) {
    try {
      settings = await invoke<AppSettings>("get_settings");
    } catch {
      // Keep the last known state.
    }
  }
  syncControls();
}

function bindControls() {
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
  clickThroughLockedInput.addEventListener("change", () => {
    void saveSettings({ clickThroughLocked: clickThroughLockedInput.checked });
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
    hide();
    if (!isTauri) return;
    await invoke("reset_position");
  });

  quitBtn.addEventListener("click", async () => {
    if (!isTauri) return;
    await invoke("quit_app");
  });

  closeBtn.addEventListener("click", hide);
}

async function boot() {
  buildCoatButtons();
  bindControls();
  await refresh();

  if (isTauri) {
    await listen<AppSettings>("cat-settings", (ev) => {
      settings = ev.payload;
      syncControls();
    });
    void getCurrentWindow().onFocusChanged(({ payload: focused }) => {
      if (focused) {
        window.clearTimeout(hideTimer);
        void refresh();
      } else {
        window.clearTimeout(hideTimer);
        hideTimer = window.setTimeout(hide, 150);
      }
    });
  }

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hide();
  });
  window.addEventListener("resize", updateMenuScroll);
}

void boot();