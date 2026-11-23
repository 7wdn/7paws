import "./style.css";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { COATS } from "./pet/coats";
import { defaultSettings } from "./defaults";
import type { AppSettings, CatPattern, CatSpot, CustomCat } from "./types";

const isTauri = "__TAURI_INTERNALS__" in window || "__TAURI__" in window;

const menuEl = document.getElementById("menu") as HTMLDivElement;
const coatsEl = document.getElementById("coats") as HTMLDivElement;
const scaleSlider = document.getElementById("scaleSlider") as HTMLInputElement;
const scaleValue = document.getElementById("scaleValue") as HTMLSpanElement;
const opacitySlider = document.getElementById("opacitySlider") as HTMLInputElement;
const opacityValue = document.getElementById("opacityValue") as HTMLSpanElement;
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
const catNameInput = document.getElementById("catName") as HTMLInputElement;
const spotsStatus = document.getElementById("spotsStatus") as HTMLSpanElement;
const spotsClearBtn = document.getElementById("spotsClearBtn") as HTMLButtonElement;
const coatCodeInput = document.getElementById("coatCodeInput") as HTMLInputElement;
const coatCodeGen = document.getElementById("coatCodeGen") as HTMLButtonElement;
const coatCodeImport = document.getElementById("coatCodeImport") as HTMLButtonElement;
const deleteCatBtn = document.getElementById("deleteCatBtn") as HTMLButtonElement;
const colorSlotButtons = Array.from(document.querySelectorAll<HTMLButtonElement>(".color-slot"));

type ColorSlot = keyof Pick<CustomCat, "fur" | "patch" | "accent" | "eye">;

let settings: AppSettings = { ...defaultSettings };
let customCats: CustomCat[] = [];
let coatGridKey = "";

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
  const slot = colorSlot;
  closeColorPopup();
  saveActiveCat({ [slot]: hex } as Partial<CustomCat>);
}

function openColorPopup(button: HTMLButtonElement, slot: ColorSlot) {
  const cat = activeCat();
  if (!cat) return;
  closeDropdown();
  if (colorSlot === slot) {
    closeColorPopup();
    return;
  }
  closeColorPopup();
  colorSlot = slot;
  colorHex.value = cat[slot];
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
  const cat = activeCat();
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
    pickColor(hex.toLowerCase());
  } else if (colorSlot && cat) {
    colorHex.value = cat[colorSlot];
  }
});

function activeCat(): CustomCat | null {
  return customCats.find((c) => c.id === settings.coat) ?? null;
}

function coatSwatch(cat: CustomCat): string {
  if (cat.pattern === "solid") return cat.fur;
  const second = cat.pattern === "calico" ? cat.accent : cat.patch;
  return `linear-gradient(135deg, ${cat.fur} 50%, ${second} 50%)`;
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
): Promise<{ fur: string; patch: string; accent: string; pattern: CatPattern }> {
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
  const pattern: CatPattern = accent ? "calico" : patch ? "bicolor" : "solid";
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
    const sw = document.createElement("span");
    sw.className = "coat-swatch";
    sw.style.background = swatch;
    const label = document.createElement("span");
    label.textContent = coat.name;
    btn.append(sw, label);
    btn.addEventListener("click", () => {
      if (settings.coat === coat.id) return;
      void saveSettings({ coat: coat.id });
    });
    coatsEl.appendChild(btn);
  }
  for (const cat of customCats) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "coat-btn";
    btn.dataset.coat = cat.id;
    const sw = document.createElement("span");
    sw.className = "coat-swatch";
    sw.style.background = coatSwatch(cat);
    const label = document.createElement("span");
    label.textContent = cat.name;
    btn.append(sw, label);
    btn.addEventListener("click", () => {
      if (settings.coat === cat.id) return;
      void saveSettings({ coat: cat.id });
    });
    coatsEl.appendChild(btn);
  }
  const add = document.createElement("button");
  add.type = "button";
  add.className = "coat-btn coat-add";
  add.textContent = "＋ 新建";
  add.addEventListener("click", () => void createCat());
  coatsEl.appendChild(add);
  menuButtonSelected(settings.coat);
}

function syncCoatGrid() {
  const key = JSON.stringify(customCats.map((c) => [c.id, c.name, c.fur, c.patch, c.accent, c.pattern]));
  if (key === coatGridKey) return;
  coatGridKey = key;
  buildCoatButtons();
}

function syncControls() {
  scaleSlider.value = String(Math.round(settings.scale * 100));
  scaleValue.textContent = `${Math.round(settings.scale * 100)}%`;
  opacitySlider.value = String(Math.round(settings.opacity * 100));
  opacityValue.textContent = `${Math.round(settings.opacity * 100)}%`;
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
  syncCoatGrid();
  menuButtonSelected(settings.coat);
  const cat = activeCat();
  if (cat) {
    if (document.activeElement !== catNameInput) catNameInput.value = cat.name;
    for (const btn of colorSlotButtons) {
      const dot = btn.querySelector<HTMLElement>(".color-dot");
      if (dot) dot.style.background = cat[btn.dataset.slot as ColorSlot];
    }
    patternLabel.textContent = patternChoices.find((c) => c.value === cat.pattern)?.label ?? "双色";
    spotsStatus.textContent = cat.spots.length ? `斑纹 ${cat.spots.length} 处` : "暂无斑纹";
    spotsClearBtn.hidden = cat.spots.length === 0;
  }
  customCoatEl.hidden = !cat;
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

async function saveActiveCat(patch: Partial<CustomCat>) {
  const cat = activeCat();
  if (!cat) return;
  const next: CustomCat = { ...cat, ...patch };
  const index = customCats.findIndex((c) => c.id === cat.id);
  if (index >= 0) customCats[index] = next;
  syncControls();
  if (!isTauri) return;
  try {
    const saved = await invoke<CustomCat>("save_custom_cat", { cat: next, activate: true });
    const i = customCats.findIndex((c) => c.id === saved.id);
    if (i >= 0) customCats[i] = saved;
    else customCats.push(saved);
    if (settings.coat !== saved.id) settings = { ...settings, coat: saved.id };
    syncControls();
  } catch {
    // Keep the local state; the next save retries.
  }
}

async function createCat() {
  const cat: CustomCat = {
    id: isTauri ? "" : `my-cat-${Date.now().toString(36)}`,
    name: "我的猫",
    fur: "#e9973f",
    patch: "#fbe8c9",
    accent: "#c26a1f",
    eye: "#5c8a3a",
    pattern: "bicolor",
    spots: [],
  };
  if (!isTauri) {
    customCats.push(cat);
    settings = { ...settings, coat: cat.id };
    syncControls();
    return;
  }
  try {
    const saved = await invoke<CustomCat>("save_custom_cat", { cat, activate: true });
    if (!customCats.some((c) => c.id === saved.id)) customCats.push(saved);
    settings = { ...settings, coat: saved.id };
    syncControls();
  } catch {
    // Ignore; the user can retry.
  }
}

async function removeActiveCat() {
  const cat = activeCat();
  if (!cat) return;
  if (!window.confirm(`删除「${cat.name}」？`)) return;
  customCats = customCats.filter((c) => c.id !== cat.id);
  if (settings.coat === cat.id) settings = { ...settings, coat: "tuxedo" };
  syncControls();
  if (!isTauri) return;
  try {
    await invoke("delete_custom_cat", { id: cat.id });
  } catch {
    // The list listener will reconcile.
  }
}

function catFromCode(raw: string): CustomCat | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return null;
    const str = (value: unknown, fallback: string) =>
      typeof value === "string" && value.trim() ? value : fallback;
    const patternRaw = str(parsed.pattern, "bicolor");
    const pattern: CatPattern = (["solid", "bicolor", "tabby", "calico"] as const).includes(
      patternRaw as CatPattern,
    )
      ? (patternRaw as CatPattern)
      : "bicolor";
    return {
      id: "",
      name: str(parsed.name, "导入的猫").slice(0, 16),
      fur: str(parsed.fur, "#151515"),
      patch: str(parsed.patch, "#f8f6ef"),
      accent: str(parsed.accent, "#e9973f"),
      eye: str(parsed.eye, "#e2b93b"),
      pattern,
      spots: Array.isArray(parsed.spots) ? (parsed.spots.slice(0, 24) as CatSpot[]) : [],
    };
  } catch {
    return null;
  }
}

async function importCoatCode() {
  const cat = catFromCode(coatCodeInput.value);
  if (!cat) {
    coatCodeImport.textContent = "格式不对";
    window.setTimeout(() => {
      coatCodeImport.textContent = "导入毛色码";
    }, 1800);
    return;
  }
  coatCodeInput.value = "";
  if (!isTauri) {
    cat.id = `my-cat-${Date.now().toString(36)}`;
    customCats.push(cat);
    settings = { ...settings, coat: cat.id };
    syncControls();
    return;
  }
  try {
    const saved = await invoke<CustomCat>("save_custom_cat", { cat, activate: true });
    if (!customCats.some((c) => c.id === saved.id)) customCats.push(saved);
    settings = { ...settings, coat: saved.id };
    syncControls();
  } catch {
    // Ignore; the user can retry.
  }
}

async function refresh() {
  if (isTauri) {
    try {
      settings = await invoke<AppSettings>("get_settings");
    } catch {
      // Keep the last known state.
    }
    try {
      customCats = await invoke<CustomCat[]>("get_custom_cats");
    } catch {
      // Keep the last known list.
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

  opacitySlider.addEventListener("input", () => {
    const pct = Number(opacitySlider.value);
    opacityValue.textContent = `${pct}%`;
  });

  opacitySlider.addEventListener("change", () => {
    void saveSettings({ opacity: Number(opacitySlider.value) / 100 });
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
    const cat = activeCat();
    if (!cat) return;
    openDropdown(
      patternSelect,
      patternChoices,
      () => cat.pattern,
      (value) => saveActiveCat({ pattern: value as CatPattern }),
    );
  });

  catNameInput.addEventListener("change", () => {
    const name = catNameInput.value.trim();
    if (!name) {
      const cat = activeCat();
      if (cat) catNameInput.value = cat.name;
      return;
    }
    saveActiveCat({ name });
  });

  spotsClearBtn.addEventListener("click", () => {
    saveActiveCat({ spots: [] });
  });

  deleteCatBtn.addEventListener("click", () => void removeActiveCat());

  coatCodeGen.addEventListener("click", () => {
    const cat = activeCat();
    if (!cat) return;
    coatCodeInput.value = JSON.stringify(cat);
    coatCodeInput.select();
  });

  coatCodeImport.addEventListener("click", () => void importCoatCode());

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
      await saveActiveCat(colors);
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
    await listen<CustomCat[]>("cat-cats", (ev) => {
      customCats = ev.payload;
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