import type { Coord } from "./types";
import { shuffled } from "./random";

/**
 * Randomized backtracking: places N cats, one per row, on distinct columns,
 * with no two cats touching (including diagonally). Since rows are filled in
 * order, two placed cats can only ever be adjacent if their rows differ by
 * exactly 1 - so each new row only needs to check the previous row's column.
 */
export function generateRandomSolution(n: number, rng: () => number = Math.random): Coord[] {
  const usedCols = new Set<number>();
  const placement: number[] = new Array(n).fill(-1);

  function backtrack(row: number): boolean {
    if (row === n) return true;
    const candidates = shuffled(
      Array.from({ length: n }, (_, c) => c),
      rng
    );
    for (const col of candidates) {
      if (usedCols.has(col)) continue;
      if (row > 0) {
        const prevCol = placement[row - 1];
        if (Math.abs(prevCol - col) <= 1) continue;
      }
      placement[row] = col;
      usedCols.add(col);
      if (backtrack(row + 1)) return true;
      usedCols.delete(col);
      placement[row] = -1;
    }
    return false;
  }

  const ok = backtrack(0);
  if (!ok) {
    throw new Error(`No valid solution exists for n=${n} (this should be impossible for n >= 1)`);
  }

  return placement.map((col, row) => ({ row, col }));
}
