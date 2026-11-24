export class ReminderController {
  private timer: number | null = null;

  configure(enabled: boolean, text: string, intervalMinutes: number): void {
    this.stop();
    if (!enabled) return;
    const minutes = Math.max(1, Math.floor(intervalMinutes));
    const trimmed = text.trim();
    const intervalMs = minutes * 60_000;
    const schedule = () => {
      this.timer = window.setTimeout(() => {
        this.speak(trimmed);
        schedule();
      }, intervalMs);
    };
    schedule();
  }

  stop(): void {
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private speak(text: string): void {
    if (!text) return;
    const synth = window.speechSynthesis;
    if (!synth) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN";
    synth.cancel();
    synth.speak(utterance);
  }
}
