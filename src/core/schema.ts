import type { BoardGrid, CellState, Coord, Difficulty, RegionGrid } from "./types";

export interface CellChange {
  row: number;
  col: number;
  prev: CellState;
  next: CellState;
}

/** One undo/redo step: a tap, a double-tap, or a cat placement plus its batched auto-X cascade. */
export interface Move {
  changes: CellChange[];
}

export interface PersistedPuzzle {
  difficulty: Difficulty;
  gridSize: number;
  regions: RegionGrid;
  solution: Coord[];
  board: BoardGrid;
  moveHistory: Move[];
  historyIndex: number;
  elapsedSeconds: number;
  startedAt: number;
  completed: boolean;
}

export interface DifficultyStats {
  completedCount: number;
  bestTimeSeconds: number | null;
  totalTimeSeconds: number;
}

export interface Stats {
  perDifficulty: Record<Difficulty, DifficultyStats>;
  totalCompleted: number;
  currentStreakDays: number;
  lastCompletedDate: string | null;
}

export interface Settings {
  theme: "system" | "light" | "dark";
  soundEnabled: boolean;
  hapticsEnabled: boolean;
}

export interface PersistedState {
  currentPuzzle: PersistedPuzzle | null;
  stats: Stats;
  settings: Settings;
}

function emptyDifficultyStats(): DifficultyStats {
  return { completedCount: 0, bestTimeSeconds: null, totalTimeSeconds: 0 };
}

export function createDefaultStats(): Stats {
  return {
    perDifficulty: {
      easy: emptyDifficultyStats(),
      medium: emptyDifficultyStats(),
      hard: emptyDifficultyStats(),
      expert: emptyDifficultyStats(),
    },
    totalCompleted: 0,
    currentStreakDays: 0,
    lastCompletedDate: null,
  };
}

export function createDefaultSettings(): Settings {
  return { theme: "system", soundEnabled: true, hapticsEnabled: true };
}

export function createDefaultPersistedState(): PersistedState {
  return {
    currentPuzzle: null,
    stats: createDefaultStats(),
    settings: createDefaultSettings(),
  };
}
