import type { Coord, RegionGrid } from "./types";
import { inBounds } from "./boardOps";

const ORTHO = [
  { dr: -1, dc: 0 },
  { dr: 1, dc: 0 },
  { dr: 0, dc: -1 },
  { dr: 0, dc: 1 },
];

export function isRegionContiguous(n: number, regions: RegionGrid, id: number): boolean {
  let start: Coord | null = null;
  let total = 0;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (regions[r][c] === id) {
        total++;
        if (!start) start = { row: r, col: c };
      }
    }
  }
  if (!start || total === 0) return false;

  const visited = new Set<string>([`${start.row},${start.col}`]);
  const stack: Coord[] = [start];
  let count = 1;
  while (stack.length) {
    const cur = stack.pop()!;
    for (const { dr, dc } of ORTHO) {
      const nr = cur.row + dr;
      const nc = cur.col + dc;
      if (!inBounds(n, nr, nc) || regions[nr][nc] !== id) continue;
      const key = `${nr},${nc}`;
      if (visited.has(key)) continue;
      visited.add(key);
      count++;
      stack.push({ row: nr, col: nc });
    }
  }
  return count === total;
}

export function orthoNeighbors(n: number, cell: Coord): Coord[] {
  const out: Coord[] = [];
  for (const { dr, dc } of ORTHO) {
    const nr = cell.row + dr;
    const nc = cell.col + dc;
    if (inBounds(n, nr, nc)) out.push({ row: nr, col: nc });
  }
  return out;
}

export function sameSolution(a: Coord[], b: Coord[]): boolean {
  if (a.length !== b.length) return false;
  const key = (arr: Coord[]) =>
    arr
      .slice()
      .sort((x, y) => x.row - y.row || x.col - y.col)
      .map((c) => `${c.row},${c.col}`)
      .join("|");
  return key(a) === key(b);
}
