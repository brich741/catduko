let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(freq: number, durationMs: number, type: OscillatorType, gainPeak: number, delayMs = 0): void {
  const audioCtx = getContext();
  if (!audioCtx) return;
  const start = audioCtx.currentTime + delayMs / 1000;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(gainPeak, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.001, start + durationMs / 1000);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(start);
  osc.stop(start + durationMs / 1000 + 0.02);
}

export function playPlaceCat(): void {
  tone(660, 120, "sine", 0.16);
  tone(880, 100, "sine", 0.1, 40);
}

export function playMarkX(): void {
  tone(320, 70, "triangle", 0.08);
}

export function playComplete(): void {
  [523, 659, 784, 1047].forEach((freq, i) => tone(freq, 220, "sine", 0.14, i * 90));
}
