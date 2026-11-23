import type { AppSettings, CatInput, CustomCat, PawSide } from "../types";
import { catAudio } from "../audio";
import { buildCoatPalette, type CoatPalette } from "./catPalette";

type Region = [number, number, number, number];

interface RefCatApi {
  setInput(keys: Set<string>, buttons: Set<string>): void;
  tap(side: "Left" | "Right"): void;
  setOptions(options: Record<string, unknown>): void;
  setCustomCoat(coat: CoatPalette): void;
  mouseMoved(): void;
  clear(): void;
  state(): string;
  headSideAt(clientX: number, clientY: number): number;
  hitRegions(): Region[];
  setPointerNdc(x: number, y: number): void;
  setMouseActive(): void;
  nudgeMouse(dx: number, dy: number): void;
  setLayout(layout: string): void;
  destroy(): void;
}

declare global {
  interface Window {
    createCat?: (
      host: HTMLElement,
      options?: { coat?: string; sleepMinutes?: number },
    ) => RefCatApi | null;
  }
}

export class SevenPawsPet {
  private readonly api: RefCatApi;
  private readonly host: HTMLElement;
  private readonly onRegions: (regions: Region[]) => void;
  private settings: AppSettings;
  private cats: CustomCat[];
  private layout: "65" | "104";
  private keys = new Set<string>();
  private buttons = new Set<string>();
  private purrTimer = 0;
  private smoothX = 0.5;
  private smoothY = 0.5;
  private lastCursorAt = 0;
  private rawX = 0.5;
  private rawY = 0.5;
  private hasRaw = false;
  private regionsKey = "";

  constructor(
    host: HTMLElement,
    settings: AppSettings,
    cats: CustomCat[],
    onRegions: (regions: Region[]) => void,
  ) {
    if (!window.createCat) throw new Error("Reference cat renderer is missing");
    const api = window.createCat(host, {
      coat: settings.coat,
      sleepMinutes: settings.sleepMinutes,
    });
    if (!api) throw new Error("Reference cat renderer failed to start");
    this.api = api;
    this.host = host;
    this.settings = settings;
    this.cats = cats;
    this.layout = settings.keyboardLayout;
    this.onRegions = onRegions;

    catAudio.setEnabled(settings.purrPet || settings.purrSleep);
    this.applyOptions(settings);
    this.api.setLayout(this.layout);
    this.clearInput();

    this.purrTimer = window.setInterval(() => {
      const state = this.api.state();
      const target = state === "petting" && this.settings.purrPet
        ? 0.85
        : state === "sleeping" && this.settings.purrSleep
          ? 0.4
          : 0;
      catAudio.setPurrIntensity(target);
      this.syncRegions();
    }, 180);

    this.refreshHitRegions();
  }

  handleInput(ev: CatInput) {
    switch (ev.kind) {
      case "keyDown":
        if (ev.repeat) return;
        this.keys.add(ev.code);
        this.api.setInput(this.keys, this.buttons);
        break;
      case "keyUp":
        this.keys.delete(ev.code);
        this.api.setInput(this.keys, this.buttons);
        break;
      case "mouseDown":
        this.buttons.add(ev.button);
        this.api.setInput(this.keys, this.buttons);
        this.api.setMouseActive();
        break;
      case "mouseUp":
        this.buttons.delete(ev.button);
        this.api.setInput(this.keys, this.buttons);
        break;
      case "mouseMoved": {
        const now = performance.now();
        const dt = this.lastCursorAt ? Math.min(0.1, (now - this.lastCursorAt) / 1000) : 0.016;
        this.lastCursorAt = now;
        const k = 1 - Math.exp(-dt * 14);
        this.smoothX += (ev.nx - this.smoothX) * k;
        this.smoothY += (ev.ny - this.smoothY) * k;

        const dx = this.smoothX - (this.layout === "104" ? 0.49 : 0.47);
        const dy = this.smoothY - 0.33;
        this.api.setPointerNdc(Math.tanh(dx * 1.1), Math.tanh(dy * 1.1));

        if (this.hasRaw) {
          const rawDx = (ev.nx - this.rawX) * window.innerWidth;
          const rawDy = (ev.ny - this.rawY) * window.innerHeight;
          this.api.nudgeMouse(
            Math.max(-0.16, Math.min(0.16, rawDx * 0.004)),
            Math.max(-0.12, Math.min(0.12, rawDy * 0.004)),
          );
        }
        this.hasRaw = true;
        this.rawX = ev.nx;
        this.rawY = ev.ny;
        this.api.setMouseActive();
        break;
      }
      case "privacyTap":
        this.api.tap(ev.side);
        break;
    }
  }

  pickHead(clientX: number, clientY: number): PawSide | null {
    const side = this.api.headSideAt(clientX, clientY);
    if (!side) return null;
    return side > 0 ? "R" : "L";
  }

  applySettings(next: AppSettings, cats: CustomCat[]) {
    const prev = this.settings;
    this.settings = next;
    this.cats = cats;
    this.applyOptions(next);

    if (next.keyboardLayout !== prev.keyboardLayout) {
      this.layout = next.keyboardLayout;
      this.api.setLayout(next.keyboardLayout);
      this.clearInput();
      this.refreshHitRegions();
    }
    if (next.leftMouse !== prev.leftMouse) {
      this.refreshHitRegions();
    }
    if (next.leftMouse !== prev.leftMouse || next.privacyMode !== prev.privacyMode) {
      this.clearInput();
    }
    if (next.purrPet !== prev.purrPet || next.purrSleep !== prev.purrSleep) {
      const wasEnabled = prev.purrPet || prev.purrSleep;
      const nowEnabled = next.purrPet || next.purrSleep;
      if (wasEnabled !== nowEnabled) catAudio.setEnabled(nowEnabled);
      if (!nowEnabled) catAudio.setPurrIntensity(0);
    }
  }

  clearInput() {
    this.keys.clear();
    this.buttons.clear();
    this.api.clear();
  }

  private syncRegions(force = false) {
    const regions = this.api.hitRegions();
    if (!regions.length) return;
    const key = regions.map((r) => r.map((v) => Math.round(v * 200)).join(",")).join("|");
    if (!force && key === this.regionsKey) return;
    this.regionsKey = key;
    this.onRegions(regions);
  }

  hitRegions(): Region[] {
    return this.api.hitRegions();
  }

  refreshHitRegions() {
    requestAnimationFrame(() => this.syncRegions(true));
  }

  press(code: string) {
    this.handleInput({ kind: "keyDown", code, repeat: false });
  }

  release(code: string) {
    this.handleInput({ kind: "keyUp", code });
  }

  destroy() {
    window.clearInterval(this.purrTimer);
    this.api.destroy();
  }

  private applyOptions(settings: AppSettings) {
    this.host.style.opacity = String(settings.opacity);
    const options: Record<string, unknown> = {
      showKeyboard: true,
      showMouse: true,
      followKeys: true,
      leftMouse: settings.leftMouse,
      sleepMinutes: settings.sleepMinutes,
      showKeyLabels: settings.showKeyLabels,
    };
    const activeCat = this.cats.find((c) => c.id === settings.coat);
    if (!activeCat) options.coat = settings.coat;
    this.api.setOptions(options);
    if (activeCat) this.api.setCustomCoat(buildCoatPalette(activeCat));
  }
}