/** Cute cat-face icon, drawn to fill a square viewBox. */
export const CAT_ICON_SVG = `
<svg class="cat-icon" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M20 34 L28 8 L46 28 Z" />
  <path d="M80 34 L72 8 L54 28 Z" />
  <path d="M25 30 L29 16 L40 27 Z" fill="var(--accent)" stroke="none" />
  <path d="M75 30 L71 16 L60 27 Z" fill="var(--accent)" stroke="none" />
  <circle cx="50" cy="58" r="33" />
  <circle cx="26" cy="66" r="8" fill="var(--accent)" stroke="none" opacity="0.55" />
  <circle cx="74" cy="66" r="8" fill="var(--accent)" stroke="none" opacity="0.55" />
  <circle cx="39" cy="55" r="7" fill="var(--surface)" stroke="none" />
  <circle cx="61" cy="55" r="7" fill="var(--surface)" stroke="none" />
  <circle cx="40.5" cy="56.5" r="3.8" stroke="none" />
  <circle cx="59.5" cy="56.5" r="3.8" stroke="none" />
  <circle cx="39" cy="54" r="1.4" fill="#fff" stroke="none" />
  <circle cx="58" cy="54" r="1.4" fill="#fff" stroke="none" />
  <path d="M46 68 L54 68 L50 73 Z" fill="var(--accent)" stroke="none" />
  <path d="M50 73 Q46 78 41 75 M50 73 Q54 78 59 75" fill="none" stroke-width="2.2" stroke-linecap="round" />
  <g stroke-width="1.6" stroke-linecap="round" opacity="0.55">
    <path d="M6 60 L24 58" />
    <path d="M6 68 L24 67" />
    <path d="M94 60 L76 58" />
    <path d="M94 68 L76 67" />
  </g>
</svg>`.trim();

type RuleKind = "region" | "rowcol" | "touch";

const RULES: Array<{ kind: RuleKind; text: string }> = [
  { kind: "region", text: "1 Cat per color" },
  { kind: "rowcol", text: "1 Cat per column &amp; row" },
  { kind: "touch", text: "Cats cannot touch" },
];

function miniCell(filled: boolean, marker: "" | "x" | "cat"): string {
  const classes = ["mini-cell"];
  if (filled) classes.push("fill");
  if (marker === "cat") classes.push("cat");
  const content = marker === "cat" ? "🐱" : marker === "x" ? "✕" : "";
  return `<span class="${classes.join(" ")}">${content}</span>`;
}

/** 3x3 diagram illustrating one placement rule, echoing the real board's color-fill/X/cat visual language. */
function miniGrid(kind: RuleKind): string {
  const cells: string[] = [];
  for (let i = 0; i < 9; i++) {
    const r = Math.floor(i / 3);
    const c = i % 3;
    const isCenter = i === 4;
    if (kind === "region") {
      cells.push(miniCell(true, isCenter ? "cat" : "x"));
    } else if (kind === "rowcol") {
      const inCross = r === 1 || c === 1;
      cells.push(miniCell(inCross, isCenter ? "cat" : inCross ? "x" : ""));
    } else {
      cells.push(miniCell(false, isCenter ? "cat" : "x"));
    }
  }
  return `<div class="rule-icon">${cells.join("")}</div>`;
}

export function ruleLegendHTML(): string {
  return `<div class="rules-row">${RULES.map(
    (r) => `<div class="rule-card">${miniGrid(r.kind)}<span class="rule-text">${r.text}</span></div>`
  ).join("")}</div>`;
}
