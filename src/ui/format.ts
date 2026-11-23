export function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function formatAverage(totalSeconds: number, count: number): string {
  if (count === 0) return "--:--";
  return formatTime(Math.round(totalSeconds / count));
}

export const DIFFICULTY_LABEL: Record<string, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  expert: "Expert",
  master: "Master",
};

export const DIFFICULTY_SUBTITLE: Record<string, string> = {
  easy: "5×5 grid",
  medium: "6×6–7×7 grid",
  hard: "8×8 grid",
  expert: "9×9–10×10 grid",
  master: "12×12 grid",
};
