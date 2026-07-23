const COLORS = ["#f6a5c0", "#ffd6e0", "#ffe8cc", "#d8f5c2", "#c2e4ff", "#d6ccff"];

export function burstConfetti(): void {
  const layer = document.createElement("div");
  layer.className = "confetti-layer";
  document.body.appendChild(layer);

  const count = 36;
  for (let i = 0; i < count; i++) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    const size = 6 + Math.random() * 8;
    piece.style.width = `${size}px`;
    piece.style.height = `${size * 0.4}px`;
    piece.style.left = `${Math.random() * 100}vw`;
    piece.style.background = COLORS[Math.floor(Math.random() * COLORS.length)];
    const duration = 1800 + Math.random() * 1400;
    piece.style.animationDuration = `${duration}ms`;
    piece.style.animationDelay = `${Math.random() * 250}ms`;
    layer.appendChild(piece);
  }

  setTimeout(() => layer.remove(), 3600);
}
