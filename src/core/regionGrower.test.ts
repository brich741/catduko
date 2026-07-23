import { describe, expect, it } from "vitest";
import { generateRandomSolution } from "./solutionGenerator";
import { growRegions } from "./regionGrower";
import type { RegionGrid } from "./types";

function isFullyPartitioned(n: number, regions: RegionGrid): boolean {
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (regions[r][c] < 0 || regions[r][c] >= n) return false;
    }
  }
  return true;
}

function regionSizes(n: number, regions: RegionGrid): number[] {
  const sizes = new Array(n).fill(0);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) sizes[regions[r][c]]++;
  return sizes;
}

function isContiguous(n: number, regions: RegionGrid, id: number): boolean {
  const cells: [number, number][] = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (regions[r][c] === id) cells.push([r, c]);
  if (cells.length === 0) return false;
  const visited = new Set<string>();
  const stack = [cells[0]];
  visited.add(`${cells[0][0]},${cells[0][1]}`);
  while (stack.length) {
    const [r, c] = stack.pop()!;
    for (const [dr, dc] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ]) {
      const nr = r + dr;
      const nc = c + dc;
      const key = `${nr},${nc}`;
      if (nr >= 0 && nr < n && nc >= 0 && nc < n && regions[nr][nc] === id && !visited.has(key)) {
        visited.add(key);
        stack.push([nr, nc]);
      }
    }
  }
  return visited.size === cells.length;
}

describe("growRegions", () => {
  it.each([5, 6, 7, 8, 9, 10])("fully partitions an n=%i grid into N contiguous regions with one seed each", (n) => {
    for (let i = 0; i < 15; i++) {
      const solution = generateRandomSolution(n);
      const regions = growRegions(n, solution);

      expect(isFullyPartitioned(n, regions)).toBe(true);

      const sizes = regionSizes(n, regions);
      expect(sizes.reduce((a, b) => a + b, 0)).toBe(n * n);
      expect(sizes.every((s) => s > 0)).toBe(true);

      for (let id = 0; id < n; id++) {
        expect(isContiguous(n, regions, id)).toBe(true);
      }

      solution.forEach((seed, id) => {
        expect(regions[seed.row][seed.col]).toBe(id);
      });
    }
  });
});
