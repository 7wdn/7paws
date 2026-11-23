import type { AppSettings } from "./types";

export const defaultSettings: AppSettings = {
  x: null,
  y: null,
  scale: 0.6,
  opacity: 1,
  alwaysOnTop: true,
  clickThroughLocked: false,
  purrPet: true,
  purrSleep: false,
  autostart: false,
  privacyMode: false,
  leftMouse: false,
  coat: "tuxedo",
  customCoat: {
    fur: "#151515",
    patch: "#f8f6ef",
    accent: "#e9973f",
    eye: "#e2b93b",
    pattern: "bicolor",
  },
  sleepMinutes: 5,
  showKeyLabels: true,
  keyboardLayout: "65",
  showTrayIcon: true,
};