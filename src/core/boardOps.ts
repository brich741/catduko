import type { BoardGrid, Coord, RegionGrid } from "./types";

export function createEmptyBoard(n: number): BoardGrid {
  return Array.from({ length: n }, () => Array<BoardGrid[number][number]>(n).fill("empty"));
}

export function cloneBoard(board: BoardGrid): BoardGrid {
  return board.map((row) => row.slice());
}

export function inBounds(n: number, r: number, c: number): boolean {
  return r >= 0 && r < n && c >= 0 && c < n;
}

export function neighbors8(n: number, r: number, c: number): Coord[] {
  const out: Coord[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (inBounds(n, nr, nc)) out.push({ row: nr, col: nc });
    }
  }
  return out;
}

export function isAdjacent(a: Coord, b: Coord): boolean {
  return Math.abs(a.row - b.row) <= 1 && Math.abs(a.col - b.col) <= 1 && !(a.row === b.row && a.col === b.col);
}

/**
 * Places a cat at (r,c) and marks X on every cell it eliminates: the rest of
 * its row, column, region, and all 8 neighbors. Mutates `board` in place.
 * Returns the list of cells that were newly marked X (for undo/animation use).
 */
export function placeCatCascade(
  board: BoardGrid,
  regions: RegionGrid,
  n: number,
  r: number,
  c: number
): Coord[] {
  const xed: Coord[] = [];
  board[r][c] = "cat";
  const regionId = regions[r][c];

  const markX = (rr: number, cc: number) => {
    if (rr === r && cc === c) return;
    if (board[rr][cc] !== "cat" && board[rr][cc] !== "x") {
      board[rr][cc] = "x";
      xed.push({ row: rr, col: cc });
    }
  };

  for (let cc = 0; cc < n; cc++) markX(r, cc);
  for (let rr = 0; rr < n; rr++) markX(rr, c);
  for (let rr = 0; rr < n; rr++) {
    for (let cc = 0; cc < n; cc++) {
      if (regions[rr][cc] === regionId) markX(rr, cc);
    }
  }
  for (const nb of neighbors8(n, r, c)) markX(nb.row, nb.col);

  return xed;
}

export function regionCells(regions: RegionGrid, n: number, regionId: number): Coord[] {
  const cells: Coord[] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (regions[r][c] === regionId) cells.push({ row: r, col: c });
    }
  }
  return cells;
}

export function rowCells(n: number, row: number): Coord[] {
  const cells: Coord[] = [];
  for (let c = 0; c < n; c++) cells.push({ row, col: c });
  return cells;
}

export function colCells(n: number, col: number): Coord[] {
  const cells: Coord[] = [];
  for (let r = 0; r < n; r++) cells.push({ row: r, col });
  return cells;
}

/**
 * Cats currently violating a rule (shared row/col/region, or adjacency),
 * for live conflict highlighting (§4.4). Placement is never blocked - this
 * is purely informational.
 */
export function findConflicts(board: BoardGrid, regions: RegionGrid, n: number): Coord[] {
  const cats: Coord[] = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (board[r][c] === "cat") cats.push({ row: r, col: c });

  const conflictKeys = new Set<string>();
  for (let i = 0; i < cats.length; i++) {
    for (let j = i + 1; j < cats.length; j++) {
      const a = cats[i];
      const b = cats[j];
      const conflicting =
        a.row === b.row ||
        a.col === b.col ||
        regions[a.row][a.col] === regions[b.row][b.col] ||
        isAdjacent(a, b);
      if (conflicting) {
        conflictKeys.add(`${a.row},${a.col}`);
        conflictKeys.add(`${b.row},${b.col}`);
      }
    }
  }

  return Array.from(conflictKeys, (key) => {
    const [row, col] = key.split(",").map(Number);
    return { row, col };
  });
}

/**
 * True once every cell holds a cat or X and the N placed cats exactly match
 * the puzzle's (unique) solution - i.e. all four rules are satisfied (§4.8).
 */
export function isBoardComplete(board: BoardGrid, n: number, solution: Coord[]): boolean {
  const solutionKeys = new Set(solution.map((c) => `${c.row},${c.col}`));
  let catCount = 0;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const cell = board[r][c];
      if (cell === "empty") return false;
      if (cell === "cat") {
        if (!solutionKeys.has(`${r},${c}`)) return false;
        catCount++;
      }
    }
  }
  return catCount === solution.length;
}
