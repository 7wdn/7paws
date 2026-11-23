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
const sleepSelect = document.getElementById("sleepSelect") as HTMLButtonElement;
const layoutSelect = document.getElementById("layoutSelect") as HTMLButtonElement;
const sleepLabel = sleepSelect.querySelector(".dropdown-label") as HTMLSpanElement;
const layoutLabel = layoutSelect.querySelector(".dropdown-label") as HTMLSpanElement;
const leftMouseInput = document.getElementById("leftMouse") as HTMLInputElement;
const clickThroughLockedInput = document.getElementById("clickThroughLocked") as HTMLInputElement;
const showTrayIconInput = document.getElementById("showTrayIcon") as HTMLInputElement;
const privacyInput = document.getElementById("privacyMode") as HTMLInputElement;
const purrPetInput = document.getElementById("purrPet") as HTMLInputElement;
const purrSleepInput = document.getElementById("purrSleep") as HTMLInputElement;
const labelsInput = document.getElementById("showKeyLabels") as HTMLInputElement;
const resetBtn = document.getElementById("resetPosBtn") as HTMLButtonElement;
const quitBtn = document.getElementById("quitBtn") as HTMLButtonElement;
const closeBtn = document.getElementById("closeBtn") as HTMLButtonElement;
const headEl = menuEl.querySelector<HTMLElement>(".menu-head");

let settings: AppSettings = { ...defaultSettings };

interface Choice {
  value: string;
  label: string;
}

const layoutChoices: Choice[] = [
  { value: "65", label: "65% 紧凑" },
  { value: "104", label: "104 键全尺寸" },
];
const sleepChoices: Choice[] = [
  { value: "1", label: "1 分钟" },
  { value: "3", label: "3 分钟" },
  { value: "5", label: "5 分钟" },
  { value: "10", label: "10 分钟" },
  { value: "30", label: "30 分钟" },
  { value: "0", label: "不睡" },
];

const dropdownPopup = document.createElement("div");
dropdownPopup.className = "dropdown-popup hidden";
dropdownPopup.setAttribute("role", "listbox");
document.body.appendChild(dropdownPopup);

let openSelect: HTMLButtonElement | null = null;

function closeDropdown() {
  if (!openSelect) return;
  openSelect.classList.remove("open");
  openSelect.setAttribute("aria-expanded", "false");
  openSelect = null;
  dropdownPopup.classList.add("hidden");
}

function positionPopup(button: HTMLButtonElement) {
  const rect = button.getBoundingClientRect();
  const width = Math.max(rect.width, 150);
  dropdownPopup.style.width = `${width}px`;
  let left = rect.left;
  if (left + width > window.innerWidth - 8) left = window.innerWidth - width - 8;
  let top = rect.bottom + 6;
  if (top + dropdownPopup.offsetHeight > window.innerHeight - 8) {
    top = rect.top - dropdownPopup.offsetHeight - 6;
  }
  dropdownPopup.style.left = `${Math.max(8, left)}px`;
  dropdownPopup.style.top = `${Math.max(8, top)}px`;
}

function openDropdown(
  button: HTMLButtonElement,
  choices: Choice[],
  current: () => string,
  pick: (value: string) => void,
) {
  if (openSelect === button) {
    closeDropdown();
    return;
  }
  closeDropdown();
  openSelect = button;
  button.classList.add("open");
  button.setAttribute("aria-expanded", "true");
  dropdownPopup.innerHTML = "";
  for (const choice of choices) {
    const option = document.createElement("button");
    option.type = "button";
    option.className = "dropdown-option";
    option.textContent = choice.label;
    option.setAttribute("role", "option");
    option.setAttribute("aria-selected", String(choice.value === current()));
    option.addEventListener("click", () => {
      pick(choice.value);
      closeDropdown();
    });
    dropdownPopup.appendChild(option);
  }
  dropdownPopup.classList.remove("hidden");
  positionPopup(button);
}

function hide() {
  closeDropdown();
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
  sleepLabel.textContent = sleepChoices.find((c) => c.value === String(settings.sleepMinutes))?.label
    ?? `${settings.sleepMinutes} 分钟`;
  layoutLabel.textContent = layoutChoices.find((c) => c.value === settings.keyboardLayout)?.label
    ?? settings.keyboardLayout;
  leftMouseInput.checked = settings.leftMouse;
  clickThroughLockedInput.checked = settings.clickThroughLocked;
  showTrayIconInput.checked = settings.showTrayIcon;
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

  sleepSelect.addEventListener("click", () => {
    openDropdown(
      sleepSelect,
      sleepChoices,
      () => String(settings.sleepMinutes),
      (value) => void saveSettings({ sleepMinutes: Number(value) }),
    );
  });

  layoutSelect.addEventListener("click", () => {
    openDropdown(
      layoutSelect,
      layoutChoices,
      () => settings.keyboardLayout,
      (value) => void saveSettings({ keyboardLayout: value === "104" ? "104" : "65" }),
    );
  });

  leftMouseInput.addEventListener("change", () => {
    void saveSettings({ leftMouse: leftMouseInput.checked });
  });
  clickThroughLockedInput.addEventListener("change", () => {
    void saveSettings({ clickThroughLocked: clickThroughLockedInput.checked });
  });
  showTrayIconInput.addEventListener("change", () => {
    void saveSettings({ showTrayIcon: showTrayIconInput.checked });
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

  headEl?.addEventListener("pointerdown", (e) => {
    if (!isTauri || e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    void getCurrentWindow().startDragging();
  });
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
  }

  window.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (openSelect) {
      closeDropdown();
      return;
    }
    hide();
  });
  document.addEventListener("pointerdown", (e) => {
    if (!openSelect) return;
    const target = e.target as Node;
    if (dropdownPopup.contains(target) || openSelect.contains(target)) return;
    closeDropdown();
  });
  menuEl.querySelector<HTMLElement>(".menu-scroll")?.addEventListener("scroll", closeDropdown, {
    passive: true,
  });
  window.addEventListener("resize", () => {
    closeDropdown();
    updateMenuScroll();
  });
}

void boot();