export type CustomCoatPattern = "solid" | "bicolor" | "tabby" | "calico";

export interface CustomCoat {
  fur: string;
  patch: string;
  accent: string;
  eye: string;
  pattern: CustomCoatPattern;
}

export interface AppSettings {
  x: number | null;
  y: number | null;
  scale: number;
  opacity: number;
  alwaysOnTop: boolean;
  clickThroughLocked: boolean;
  purrPet: boolean;
  purrSleep: boolean;
  autostart: boolean;
  privacyMode: boolean;
  leftMouse: boolean;
  coat: string;
  customCoat: CustomCoat;
  sleepMinutes: number;
  showKeyLabels: boolean;
  keyboardLayout: "65" | "104";
  showTrayIcon: boolean;
}

export type CatInput =
  | { kind: "keyDown"; code: string; repeat: boolean }
  | { kind: "keyUp"; code: string }
  | { kind: "mouseDown"; button: string }
  | { kind: "mouseUp"; button: string }
  | { kind: "mouseMoved"; nx: number; ny: number }
  | { kind: "privacyTap"; side: "Left" | "Right" };

export type PawSide = "L" | "R";