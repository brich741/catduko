import type { CellState } from "../core/types";
import { CAT_ICON_SVG } from "./icons";
import { regionColorDark, regionColorLight } from "./regionPalette";

export interface BoardHandlers {
  onTap: (row: number, col: number) => void;
  onDoubleTap: (row: number, col: number) => void;
}

const DOUBLE_TAP_MS = 300;

/**
 * Renders the puzzle grid and owns persistent per-cell DOM nodes so repeat
 * updates (e.g. every timer tick) only touch classList strings rather than
 * recreating elements - which would otherwise restart CSS placement/X
 * animations on every render.
 */
export class BoardView {
  private cells: HTMLButtonElement[][] = [];
  private gridSize = 0;
  private lastTap: { row: number; col: number; time: number } | null = null;

  constructor(private container: HTMLElement, private handlers: BoardHandlers) {}

  build(gridSize: number, regions: number[][], isDark: boolean): void {
    this.gridSize = gridSize;
    this.container.innerHTML = "";
    this.container.style.gridTemplateColumns = `repeat(${gridSize}, 1fr)`;
    this.cells = [];
    this.lastTap = null;

    for (let r = 0; r < gridSize; r++) {
      const rowEls: HTMLButtonElement[] = [];
      for (let c = 0; c < gridSize; c++) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "cell";
        btn.setAttribute("aria-label", `Row ${r + 1}, column ${c + 1}`);
        btn.style.background = (isDark ? regionColorDark : regionColorLight)(regions[r][c]);
        btn.innerHTML = `${CAT_ICON_SVG}<span class="x-mark"></span>`;
        btn.addEventListener("pointerup", (e) => {
          e.preventDefault();
          this.handleTapAt(r, c);
        });
        this.container.appendChild(btn);
        rowEls.push(btn);
      }
      this.cells.push(rowEls);
    }
  }

  private handleTapAt(row: number, col: number): void {
    const now = performance.now();
    if (this.lastTap && this.lastTap.row === row && this.lastTap.col === col && now - this.lastTap.time < DOUBLE_TAP_MS) {
      this.lastTap = null;
      this.handlers.onDoubleTap(row, col);
    } else {
      this.lastTap = { row, col, time: now };
      this.handlers.onTap(row, col);
    }
  }

  updateColors(regions: number[][], isDark: boolean): void {
    const fn = isDark ? regionColorDark : regionColorLight;
    for (let r = 0; r < this.gridSize; r++) {
      for (let c = 0; c < this.gridSize; c++) {
        this.cells[r][c].style.background = fn(regions[r][c]);
      }
    }
  }

  update(board: CellState[][], conflictKeys: Set<string>, hintKeys: Set<string>): void {
    for (let r = 0; r < this.gridSize; r++) {
      for (let c = 0; c < this.gridSize; c++) {
        const state = board[r][c];
        const key = `${r},${c}`;
        const classes = ["cell"];
        if (state === "cat") classes.push("has-cat");
        if (state === "x") classes.push("has-x");
        if (conflictKeys.has(key)) classes.push("conflict");
        if (hintKeys.has(key)) classes.push("hint-highlight");
        this.cells[r][c].className = classes.join(" ");
      }
    }
  }
}
