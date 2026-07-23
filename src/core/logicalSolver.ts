import type { BoardGrid, Coord, RegionGrid } from "./types";
import { colCells, createEmptyBoard, placeCatCascade, regionCells, rowCells } from "./boardOps";

export type Family = "row" | "col" | "region";
export type DeductionKind = "line-completion" | "region-completion" | "intersection" | "fish";

export interface Deduction {
  tier: 1 | 2 | 3 | 4;
  kind: DeductionKind;
  /** set when this deduction places a cat */
  place?: Coord;
  /** cells to mark X (empty when `place` is set - placement's own cascade handles X's) */
  eliminate: Coord[];
  /** cells worth glowing to illustrate the deduction, for the Hint UI */
  highlight: Coord[];
  explanation: string;
}

export interface SolveResult {
  solved: boolean;
  maxTier: number;
  board: BoardGrid;
  steps: Deduction[];
}

interface Groups {
  row: Coord[][];
  col: Coord[][];
  region: Coord[][];
}

const FAMILIES: Family[] = ["row", "col", "region"];

function buildGroups(n: number, regions: RegionGrid): Groups {
  return {
    row: Array.from({ length: n }, (_, r) => rowCells(n, r)),
    col: Array.from({ length: n }, (_, c) => colCells(n, c)),
    region: Array.from({ length: n }, (_, id) => regionCells(regions, n, id)),
  };
}

function groupIdOf(family: Family, regions: RegionGrid, cell: Coord): number {
  if (family === "row") return cell.row;
  if (family === "col") return cell.col;
  return regions[cell.row][cell.col];
}

function familyLabel(family: Family, plural = false): string {
  if (family === "row") return plural ? "rows" : "row";
  if (family === "col") return plural ? "columns" : "column";
  return plural ? "regions" : "region";
}

function isGroupSolved(board: BoardGrid, cells: Coord[]): boolean {
  return cells.some((c) => board[c.row][c.col] === "cat");
}

function candidatesOf(board: BoardGrid, cells: Coord[]): Coord[] {
  return cells.filter((c) => board[c.row][c.col] === "empty");
}

function countPlacedCats(board: BoardGrid, n: number): number {
  let count = 0;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (board[r][c] === "cat") count++;
  return count;
}

/** True if any not-yet-solved group has zero remaining candidates (dead-end state). */
export function hasContradiction(board: BoardGrid, regions: RegionGrid, n: number): boolean {
  const groups = buildGroups(n, regions);
  for (const family of FAMILIES) {
    for (let id = 0; id < n; id++) {
      const cells = groups[family][id];
      if (isGroupSolved(board, cells)) continue;
      if (candidatesOf(board, cells).length === 0) return true;
    }
  }
  return false;
}

/**
 * Cells belonging to any not-yet-solved row/column/region that has zero
 * remaining candidates - a dead-end state the board can still reach even
 * with placement guarded (§4.2), e.g. by clearing a cat and leaving its
 * old auto-X cascade in place. Used for live highlighting (§4.4) so a
 * broken board is never silently unsolvable.
 */
export function contradictionCells(board: BoardGrid, regions: RegionGrid, n: number): Coord[] {
  const groups = buildGroups(n, regions);
  const seen = new Set<string>();
  const cells: Coord[] = [];
  for (const family of FAMILIES) {
    for (let id = 0; id < n; id++) {
      const groupCells = groups[family][id];
      if (isGroupSolved(board, groupCells)) continue;
      if (candidatesOf(board, groupCells).length > 0) continue;
      for (const cell of groupCells) {
        const key = `${cell.row},${cell.col}`;
        if (!seen.has(key)) {
          seen.add(key);
          cells.push(cell);
        }
      }
    }
  }
  return cells;
}

function* combinations(items: number[], k: number): Generator<number[]> {
  const n = items.length;
  if (k > n || k <= 0) return;
  const idx = Array.from({ length: k }, (_, i) => i);
  while (true) {
    yield idx.map((i) => items[i]);
    let i = k - 1;
    while (i >= 0 && idx[i] === n - k + i) i--;
    if (i < 0) return;
    idx[i]++;
    for (let j = i + 1; j < k; j++) idx[j] = idx[j - 1] + 1;
  }
}

function explainCompletion(family: Family, id: number): string {
  if (family === "row") return `Row ${id + 1} has only one cell left that can hold a cat.`;
  if (family === "col") return `Column ${id + 1} has only one cell left that can hold a cat.`;
  return `This color region has only one cell left that can hold a cat.`;
}

function explainFish(famA: Family, famB: Family, k: number): string {
  const bLabel = familyLabel(famB, true);
  if (k === 1) {
    return `This ${familyLabel(famA)}'s remaining candidates are all within a single ${familyLabel(
      famB
    )}, so the rest of that ${familyLabel(famB)} can be marked X.`;
  }
  const aLabel = familyLabel(famA, true);
  const chainNote = k >= 3 ? " (a chained, multi-group deduction)" : "";
  return `These ${k} ${aLabel} have remaining candidates confined to the same ${k} ${bLabel}, so the rest of those ${bLabel} can be marked X${chainNote}.`;
}

const FISH_PAIRS: [Family, Family][] = [
  ["region", "row"],
  ["region", "col"],
  ["row", "region"],
  ["col", "region"],
  ["row", "col"],
  ["col", "row"],
];

/**
 * Finds the single next logical deduction available from the current board
 * state, trying techniques in increasing tier order (§2.2). Returns null if
 * the board is contradictory (no legal continuation) or if no deduction of
 * any graded tier applies - i.e. the position isn't reachable by pure logic
 * alone from here.
 */
export function findNextDeduction(board: BoardGrid, regions: RegionGrid, n: number): Deduction | null {
  if (hasContradiction(board, regions, n)) return null;

  const groups = buildGroups(n, regions);

  // Tier 1: line/region completion (a group with exactly one candidate left)
  for (const family of FAMILIES) {
    for (let id = 0; id < n; id++) {
      const cells = groups[family][id];
      if (isGroupSolved(board, cells)) continue;
      const cands = candidatesOf(board, cells);
      if (cands.length === 1) {
        return {
          tier: 1,
          kind: family === "region" ? "region-completion" : "line-completion",
          place: cands[0],
          eliminate: [],
          highlight: cells,
          explanation: explainCompletion(family, id),
        };
      }
    }
  }

  // Tiers 2-4: generalized cross-family fish (k groups of family A confined
  // to k groups of family B). k=1 is region<->row/col intersection (tier 2),
  // k=2 is the classic two-group X-wing (tier 3), k>=3 is the chained
  // generalization (tier 4).
  for (let k = 1; k <= n - 1; k++) {
    const tier = (k === 1 ? 2 : k === 2 ? 3 : 4) as 2 | 3 | 4;
    for (const [famA, famB] of FISH_PAIRS) {
      const unsolvedIds: number[] = [];
      for (let id = 0; id < n; id++) {
        if (!isGroupSolved(board, groups[famA][id])) unsolvedIds.push(id);
      }
      if (unsolvedIds.length < k) continue;

      for (const combo of combinations(unsolvedIds, k)) {
        const comboSet = new Set(combo);
        const candCells: Coord[] = [];
        let deadGroup = false;
        for (const id of combo) {
          const cands = candidatesOf(board, groups[famA][id]);
          if (cands.length === 0) {
            deadGroup = true;
            break;
          }
          candCells.push(...cands);
        }
        if (deadGroup) continue;

        const bIds = new Set<number>();
        for (const cell of candCells) bIds.add(groupIdOf(famB, regions, cell));
        if (bIds.size !== k) continue;

        const eliminate: Coord[] = [];
        for (const bId of bIds) {
          const bCells = groups[famB][bId];
          if (isGroupSolved(board, bCells)) continue;
          for (const cell of bCells) {
            if (board[cell.row][cell.col] !== "empty") continue;
            if (!comboSet.has(groupIdOf(famA, regions, cell))) eliminate.push(cell);
          }
        }

        if (eliminate.length > 0) {
          const highlight = combo.flatMap((id) => groups[famA][id]).concat(eliminate);
          return {
            tier,
            kind: k === 1 ? "intersection" : "fish",
            eliminate,
            highlight,
            explanation: explainFish(famA, famB, k),
          };
        }
      }
    }
  }

  return null;
}

export function applyDeduction(board: BoardGrid, regions: RegionGrid, n: number, deduction: Deduction): void {
  if (deduction.place) {
    placeCatCascade(board, regions, n, deduction.place.row, deduction.place.col);
    return;
  }
  for (const cell of deduction.eliminate) {
    if (board[cell.row][cell.col] === "empty") board[cell.row][cell.col] = "x";
  }
}

/**
 * Runs the graded solver to completion from an empty board, used at
 * generation time to verify pure-logic solvability and grade difficulty
 * (§2.1 step 5). Never guesses/backtracks - if no deduction applies before
 * all N cats are placed, the puzzle is rejected as not pure-logic solvable.
 */
export function solvePuzzle(regions: RegionGrid, n: number): SolveResult {
  const board = createEmptyBoard(n);
  const steps: Deduction[] = [];
  let maxTier = 0;
  const guardLimit = n * n * 20;
  let guard = 0;

  while (true) {
    if (countPlacedCats(board, n) === n) {
      return { solved: true, maxTier, board, steps };
    }
    if (guard++ > guardLimit) {
      return { solved: false, maxTier, board, steps };
    }
    const deduction = findNextDeduction(board, regions, n);
    if (!deduction) {
      return { solved: false, maxTier, board, steps };
    }
    maxTier = Math.max(maxTier, deduction.tier);
    applyDeduction(board, regions, n, deduction);
    steps.push(deduction);
  }
}
