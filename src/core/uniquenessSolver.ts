import type { Coord, RegionGrid } from "./types";

/**
 * Plain backtracking constraint solver (no logical grading) used only to
 * verify how many valid solutions a region partition has. Places one cat per
 * row, pruning on column/region reuse and 8-way adjacency to the previous
 * row's placement. Stops early once `limit` solutions have been found, and
 * returns each solution found as one Coord per row.
 */
export function findSolutions(regions: RegionGrid, n: number, limit = 2): Coord[][] {
  const usedCols = new Array<boolean>(n).fill(false);
  const usedRegions = new Array<boolean>(n).fill(false);
  const placedCols: number[] = new Array(n).fill(-1);
  const solutions: Coord[][] = [];

  function backtrack(row: number): void {
    if (solutions.length >= limit) return;
    if (row === n) {
      solutions.push(placedCols.map((col, r) => ({ row: r, col })));
      return;
    }
    for (let col = 0; col < n; col++) {
      if (usedCols[col]) continue;
      const regionId = regions[row][col];
      if (usedRegions[regionId]) continue;
      if (row > 0) {
        const prevCol = placedCols[row - 1];
        if (Math.abs(prevCol - col) <= 1) continue;
      }
      usedCols[col] = true;
      usedRegions[regionId] = true;
      placedCols[row] = col;

      backtrack(row + 1);

      usedCols[col] = false;
      usedRegions[regionId] = false;
      placedCols[row] = -1;

      if (solutions.length >= limit) return;
    }
  }

  backtrack(0);
  return solutions;
}

export function countSolutions(regions: RegionGrid, n: number, limit = 2): number {
  return findSolutions(regions, n, limit).length;
}

export function hasUniqueSolution(regions: RegionGrid, n: number): boolean {
  return countSolutions(regions, n, 2) === 1;
}
