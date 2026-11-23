import "./style.css";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { COATS } from "./pet/coats";
import { defaultSettings } from "./defaults";
import type { AppSettings, CustomCoat, CustomCoatPattern } from "./types";

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
const autostartInput = document.getElementById("autostart") as HTMLInputElement;
const privacyInput = document.getElementById("privacyMode") as HTMLInputElement;
const purrPetInput = document.getElementById("purrPet") as HTMLInputElement;
const purrSleepInput = document.getElementById("purrSleep") as HTMLInputElement;
const labelsInput = document.getElementById("showKeyLabels") as HTMLInputElement;
const resetBtn = document.getElementById("resetPosBtn") as HTMLButtonElement;
const quitBtn = document.getElementById("quitBtn") as HTMLButtonElement;
const closeBtn = document.getElementById("closeBtn") as HTMLButtonElement;
const headEl = menuEl.querySelector<HTMLElement>(".menu-head");
const customCoatEl = document.getElementById("customCoat") as HTMLDivElement;
const patternSelect = document.getElementById("patternSelect") as HTMLButtonElement;
const patternLabel = patternSelect.querySelector(".dropdown-label") as HTMLSpanElement;
const photoBtn = document.getElementById("photoBtn") as HTMLButtonElement;
const photoInput = document.getElementById("photoInput") as HTMLInputElement;
const colorSlotButtons = Array.from(document.querySelectorAll<HTMLButtonElement>(".color-slot"));

type ColorSlot = keyof Pick<CustomCoat, "fur" | "patch" | "accent" | "eye">;

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
const patternChoices: Choice[] = [
  { value: "solid", label: "纯色" },
  { value: "bicolor", label: "双色" },
  { value: "tabby", label: "虎斑" },
  { value: "calico", label: "三花" },
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
  closeColorPopup();
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

const COLOR_SWATCHES = [
  "#151515", "#2b2620", "#3f3324", "#4d3d2b", "#7a4312", "#8b8f86",
  "#a08a6c", "#b5b1a2", "#c26a1f", "#e9973f", "#e2b93b", "#c79a2e",
  "#8090a0", "#667686", "#5c8a3a", "#5aa9c9", "#fbe8c9", "#f8f6ef",
];

const colorPopup = document.createElement("div");
colorPopup.className = "color-popup hidden";
colorPopup.innerHTML = `<div class="color-grid"></div><input class="color-hex" type="text" maxlength="7" spellcheck="false" aria-label="颜色值" />`;
document.body.appendChild(colorPopup);
const colorGrid = colorPopup.querySelector<HTMLDivElement>(".color-grid")!;
const colorHex = colorPopup.querySelector<HTMLInputElement>(".color-hex")!;

let colorSlot: ColorSlot | null = null;

for (const swatch of COLOR_SWATCHES) {
  const option = document.createElement("button");
  option.type = "button";
  option.style.background = swatch;
  option.title = swatch;
  option.addEventListener("click", () => pickColor(swatch));
  colorGrid.appendChild(option);
}

function closeColorPopup() {
  if (!colorSlot) return;
  colorSlot = null;
  colorPopup.classList.add("hidden");
}

function pickColor(hex: string) {
  if (!colorSlot) return;
  const next = { ...settings.customCoat, [colorSlot]: hex };
  closeColorPopup();
  void saveSettings({ coat: "custom", customCoat: next });
}

function openColorPopup(button: HTMLButtonElement, slot: ColorSlot) {
  closeDropdown();
  if (colorSlot === slot) {
    closeColorPopup();
    return;
  }
  closeColorPopup();
  colorSlot = slot;
  colorHex.value = settings.customCoat[slot];
  colorPopup.classList.remove("hidden");
  const rect = button.getBoundingClientRect();
  const width = colorPopup.offsetWidth;
  const height = colorPopup.offsetHeight;
  let left = rect.left;
  if (left + width > window.innerWidth - 8) left = window.innerWidth - width - 8;
  let top = rect.bottom + 6;
  if (top + height > window.innerHeight - 8) top = rect.top - height - 6;
  colorPopup.style.left = `${Math.max(8, left)}px`;
  colorPopup.style.top = `${Math.max(8, top)}px`;
}

colorHex.addEventListener("keydown", (e) => {
  if (e.key === "Enter") colorHex.blur();
});
colorHex.addEventListener("change", () => {
  const raw = colorHex.value.trim();
  const hex = raw.startsWith("#") ? raw : `#${raw}`;
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
    pickColor(hex.toLowerCase());
  } else if (colorSlot) {
    colorHex.value = settings.customCoat[colorSlot];
  }
});

function refreshCustomSwatch() {
  const swatch = coatsEl.querySelector<HTMLElement>('[data-coat="custom"] .coat-swatch');
  if (!swatch) return;
  const coat = settings.customCoat;
  swatch.style.background = coat.pattern === "solid"
    ? coat.fur
    : `linear-gradient(135deg, ${coat.fur} 50%, ${coat.pattern === "calico" ? coat.accent : coat.patch} 50%)`;
}

function hexOf(rgb: number[]): string {
  return `#${rgb
    .map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0"))
    .join("")}`;
}

// Local-only palette extraction: downsample, drop the edges, cluster the pixels
// and pick the largest colour plus the two most distinct ones. No photo leaves the device.
async function extractColorsFromPhoto(
  file: File,
): Promise<{ fur: string; patch: string; accent: string; pattern: CustomCoatPattern }> {
  // createImageBitmap is missing from older WKWebView, so decode through an <img>.
  const url = URL.createObjectURL(file);
  let image: HTMLImageElement;
  try {
    image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("decode failed"));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
  const width = 96;
  const height = Math.max(16, Math.round((image.height / image.width) * width));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("canvas unavailable");
  ctx.drawImage(image, 0, 0, width, height);
  const { data } = ctx.getImageData(0, 0, width, height);
  const samples: number[][] = [];
  for (let y = Math.floor(height * 0.08); y < height * 0.92; y += 1) {
    for (let x = Math.floor(width * 0.08); x < width * 0.92; x += 1) {
      const i = (y * width + x) * 4;
      if (data[i + 3] < 200) continue;
      samples.push([data[i], data[i + 1], data[i + 2]]);
    }
  }
  if (samples.length < 32) throw new Error("no pixels");
  const centers = [0.12, 0.4, 0.68, 0.9].map((f) => [...samples[Math.floor(f * (samples.length - 1))]]);
  const counts = new Array(centers.length).fill(0);
  for (let iter = 0; iter < 12; iter += 1) {
    const sums = centers.map(() => [0, 0, 0]);
    counts.fill(0);
    for (const sample of samples) {
      let best = 0;
      let bestDist = Infinity;
      for (let k = 0; k < centers.length; k += 1) {
        const c = centers[k];
        const dist = (sample[0] - c[0]) ** 2 + (sample[1] - c[1]) ** 2 + (sample[2] - c[2]) ** 2;
        if (dist < bestDist) {
          bestDist = dist;
          best = k;
        }
      }
      counts[best] += 1;
      sums[best][0] += sample[0];
      sums[best][1] += sample[1];
      sums[best][2] += sample[2];
    }
    for (let k = 0; k < centers.length; k += 1) {
      if (counts[k]) centers[k] = sums[k].map((v) => v / counts[k]);
    }
  }
  const ranked = centers.map((c, k) => ({ c, n: counts[k] })).sort((a, b) => b.n - a.n);
  const distance = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const fur = ranked[0].c;
  const patch = ranked.slice(1).find((r) => distance(r.c, fur) > 60)?.c;
  const accent = ranked.slice(1).find((r) => distance(r.c, fur) > 60 && (!patch || distance(r.c, patch) > 60))?.c;
  const pattern: CustomCoatPattern = accent ? "calico" : patch ? "bicolor" : "solid";
  return {
    fur: hexOf(fur),
    patch: hexOf(patch ?? fur),
    accent: hexOf(accent ?? patch ?? fur),
    pattern,
  };
}

function hide() {
  closeDropdown();
  if (isTauri) {
    void invoke("close_settings");
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
  autostartInput.checked = settings.autostart;
  privacyInput.checked = settings.privacyMode;
  purrPetInput.checked = settings.purrPet;
  purrSleepInput.checked = settings.purrSleep;
  labelsInput.checked = settings.showKeyLabels;
  menuButtonSelected(settings.coat);
  for (const btn of colorSlotButtons) {
    const dot = btn.querySelector<HTMLElement>(".color-dot");
    if (dot) dot.style.background = settings.customCoat[btn.dataset.slot as ColorSlot];
  }
  patternLabel.textContent = patternChoices.find((c) => c.value === settings.customCoat.pattern)?.label ?? "双色";
  customCoatEl.hidden = settings.coat !== "custom";
  refreshCustomSwatch();
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
  autostartInput.addEventListener("change", () => {
    void saveSettings({ autostart: autostartInput.checked });
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

  patternSelect.addEventListener("click", () => {
    openDropdown(
      patternSelect,
      patternChoices,
      () => settings.customCoat.pattern,
      (value) => void saveSettings({
        coat: "custom",
        customCoat: { ...settings.customCoat, pattern: value as CustomCoatPattern },
      }),
    );
  });

  for (const btn of colorSlotButtons) {
    btn.addEventListener("click", () => openColorPopup(btn, btn.dataset.slot as ColorSlot));
  }

  photoBtn.addEventListener("click", () => photoInput.click());
  photoInput.addEventListener("change", async () => {
    const file = photoInput.files?.[0];
    photoInput.value = "";
    if (!file) return;
    photoBtn.disabled = true;
    photoBtn.textContent = "正在取色…";
    try {
      const colors = await extractColorsFromPhoto(file);
      await saveSettings({ coat: "custom", customCoat: { ...settings.customCoat, ...colors } });
      photoBtn.textContent = "已取色，可继续微调";
    } catch {
      photoBtn.textContent = "这张照片读不出来，换一张试试";
    } finally {
      photoBtn.disabled = false;
      window.setTimeout(() => {
        photoBtn.textContent = "从照片取色";
      }, 2400);
    }
  });

  resetBtn.addEventListener("click", async () => {
    if (isTauri) {
      await invoke("reset_position");
    }
    hide();
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
    if (colorSlot) {
      closeColorPopup();
      return;
    }
    if (openSelect) {
      closeDropdown();
      return;
    }
    hide();
  });
  document.addEventListener("pointerdown", (e) => {
    const target = e.target as Node;
    if (openSelect && !(dropdownPopup.contains(target) || openSelect.contains(target))) {
      closeDropdown();
    }
    if (colorSlot && !colorPopup.contains(target) && !(target instanceof Element && target.closest(".color-slot"))) {
      closeColorPopup();
    }
  });
  menuEl.querySelector<HTMLElement>(".menu-scroll")?.addEventListener("scroll", () => {
    closeDropdown();
    closeColorPopup();
  }, {
    passive: true,
  });
  window.addEventListener("resize", () => {
    closeDropdown();
    closeColorPopup();
    updateMenuScroll();
  });
}

void boot();