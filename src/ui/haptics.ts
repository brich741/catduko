export function vibrate(pattern: number | number[]): void {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  navigator.vibrate(pattern);
}

export const HAPTIC_CAT_PLACED = 15;
export const HAPTIC_COMPLETE = [20, 40, 20, 40, 60];
