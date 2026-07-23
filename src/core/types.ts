export type Difficulty = "easy" | "medium" | "hard" | "expert";

export type CellState = "empty" | "x" | "cat";

export interface Coord {
  row: number;
  col: number;
}

/** region id per cell, indexed [row][col] */
export type RegionGrid = number[][];

/** cell state per cell, indexed [row][col] */
export type BoardGrid = CellState[][];

export interface Puzzle {
  difficulty: Difficulty;
  gridSize: number;
  regions: RegionGrid;
  /** the one true solution, as one coord per row, sorted by row */
  solution: Coord[];
}

export const DIFFICULTY_TIER: Record<Difficulty, number> = {
  easy: 1,
  medium: 2,
  hard: 3,
  expert: 4,
};

export const DIFFICULTY_GRID_SIZES: Record<Difficulty, number[]> = {
  easy: [5],
  medium: [6, 7],
  hard: [8],
  expert: [9, 10],
};
