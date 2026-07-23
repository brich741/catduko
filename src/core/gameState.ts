import type { CellState, Coord, Difficulty } from "./types";
import type { CellChange, Move, PersistedPuzzle, Settings } from "./schema";
import { loadState, saveState } from "./persistence";
import { generatePuzzle } from "./puzzleGenerator";
import { createEmptyBoard, findConflicts, isBoardComplete, neighbors8 } from "./boardOps";
import { findNextDeduction, type Deduction } from "./logicalSolver";
import { todayDateString, isDayBefore } from "./dateUtils";

export type Listener = () => void;

function cloneBoard<T>(board: T[][]): T[][] {
  return board.map((row) => row.slice());
}

/**
 * Owns the single in-progress puzzle plus stats/settings, mirrors every
 * change to localStorage (§6 autosave), and drives the undo/redo stack,
 * timer, and completion/streak bookkeeping. UI subscribes for re-renders.
 */
export class GameState {
  private state = loadState();
  private listeners = new Set<Listener>();
  private timerHandle: ReturnType<typeof setInterval> | null = null;

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify(): void {
    for (const fn of this.listeners) fn();
  }

  private persist(): void {
    saveState(this.state);
  }

  private commit(): void {
    this.persist();
    this.notify();
  }

  // ---- accessors ----

  get puzzle(): PersistedPuzzle | null {
    return this.state.currentPuzzle;
  }

  get settings(): Settings {
    return this.state.settings;
  }

  get stats() {
    return this.state.stats;
  }

  get moveCount(): number {
    return this.state.currentPuzzle?.historyIndex ?? 0;
  }

  get canUndo(): boolean {
    return (this.state.currentPuzzle?.historyIndex ?? 0) > 0;
  }

  get canRedo(): boolean {
    const cp = this.state.currentPuzzle;
    return !!cp && cp.historyIndex < cp.moveHistory.length;
  }

  get conflicts(): Coord[] {
    const cp = this.state.currentPuzzle;
    if (!cp) return [];
    return findConflicts(cp.board, cp.regions, cp.gridSize);
  }

  // ---- puzzle lifecycle ----

  startNewPuzzle(difficulty: Difficulty): void {
    this.stopTimer();
    const puzzle = generatePuzzle(difficulty);
    this.state.currentPuzzle = {
      difficulty: puzzle.difficulty,
      gridSize: puzzle.gridSize,
      regions: puzzle.regions,
      solution: puzzle.solution,
      board: createEmptyBoard(puzzle.gridSize),
      moveHistory: [],
      historyIndex: 0,
      elapsedSeconds: 0,
      startedAt: Date.now(),
      completed: false,
    };
    this.commit();
    this.startTimer();
  }

  // ---- input handling (§4.2) ----

  handleTap(row: number, col: number): void {
    const cp = this.state.currentPuzzle;
    if (!cp || cp.completed) return;
    const cur = cp.board[row][col];
    if (cur === "cat") return; // single tap never touches a placed cat
    const next: CellState = cur === "empty" ? "x" : "empty";
    this.applyMove(cp, { changes: [{ row, col, prev: cur, next }] });
  }

  handleDoubleTap(row: number, col: number): void {
    const cp = this.state.currentPuzzle;
    if (!cp || cp.completed) return;
    const cur = cp.board[row][col];

    if (cur === "cat") {
      this.applyMove(cp, { changes: [{ row, col, prev: "cat", next: "empty" }] });
      return;
    }

    const changes: CellChange[] = [{ row, col, prev: cur, next: "cat" }];
    const regionId = cp.regions[row][col];
    const mark = (rr: number, cc: number) => {
      if (rr === row && cc === col) return;
      const prev = cp.board[rr][cc];
      if (prev !== "cat" && prev !== "x") changes.push({ row: rr, col: cc, prev, next: "x" });
    };
    for (let c = 0; c < cp.gridSize; c++) mark(row, c);
    for (let r = 0; r < cp.gridSize; r++) mark(r, col);
    for (let r = 0; r < cp.gridSize; r++) {
      for (let c = 0; c < cp.gridSize; c++) {
        if (cp.regions[r][c] === regionId) mark(r, c);
      }
    }
    for (const nb of neighbors8(cp.gridSize, row, col)) mark(nb.row, nb.col);

    this.applyMove(cp, { changes });
  }

  private applyMove(cp: PersistedPuzzle, move: Move): void {
    cp.moveHistory = cp.moveHistory.slice(0, cp.historyIndex);
    cp.moveHistory.push(move);
    cp.historyIndex = cp.moveHistory.length;
    for (const change of move.changes) cp.board[change.row][change.col] = change.next;

    this.checkCompletion(cp);
    this.commit();
  }

  // ---- undo / redo (§4.6) ----

  undo(): void {
    const cp = this.state.currentPuzzle;
    if (!cp || cp.historyIndex === 0) return;
    const move = cp.moveHistory[cp.historyIndex - 1];
    for (const change of move.changes) cp.board[change.row][change.col] = change.prev;
    cp.historyIndex -= 1;
    if (cp.completed) {
      cp.completed = false;
      this.startTimer();
    }
    this.commit();
  }

  redo(): void {
    const cp = this.state.currentPuzzle;
    if (!cp || cp.historyIndex >= cp.moveHistory.length) return;
    const move = cp.moveHistory[cp.historyIndex];
    for (const change of move.changes) cp.board[change.row][change.col] = change.next;
    cp.historyIndex += 1;
    this.checkCompletion(cp);
    this.commit();
  }

  // ---- hint (§4.5) ----

  getHint(): Deduction | null {
    const cp = this.state.currentPuzzle;
    if (!cp || cp.completed) return null;
    return findNextDeduction(cp.board, cp.regions, cp.gridSize);
  }

  // ---- completion + stats (§4.8, §6, §9) ----

  private checkCompletion(cp: PersistedPuzzle): void {
    if (cp.completed) return;
    if (!isBoardComplete(cp.board, cp.gridSize, cp.solution)) return;
    cp.completed = true;
    this.stopTimer();
    this.recordCompletion(cp.difficulty, cp.elapsedSeconds);
  }

  private recordCompletion(difficulty: Difficulty, timeSeconds: number): void {
    const stats = this.state.stats;
    const d = stats.perDifficulty[difficulty];
    d.completedCount += 1;
    d.totalTimeSeconds += timeSeconds;
    if (d.bestTimeSeconds === null || timeSeconds < d.bestTimeSeconds) d.bestTimeSeconds = timeSeconds;
    stats.totalCompleted += 1;

    const today = todayDateString();
    if (stats.lastCompletedDate === today) {
      // already counted today
    } else if (stats.lastCompletedDate && isDayBefore(stats.lastCompletedDate, today)) {
      stats.currentStreakDays += 1;
    } else {
      stats.currentStreakDays = 1;
    }
    stats.lastCompletedDate = today;
  }

  // ---- timer (§4.7) ----

  startTimer(): void {
    if (this.timerHandle !== null) return;
    const cp = this.state.currentPuzzle;
    if (!cp || cp.completed) return;
    this.timerHandle = setInterval(() => {
      const puzzle = this.state.currentPuzzle;
      if (!puzzle || puzzle.completed) {
        this.stopTimer();
        return;
      }
      puzzle.elapsedSeconds += 1;
      this.commit();
    }, 1000);
  }

  stopTimer(): void {
    if (this.timerHandle !== null) {
      clearInterval(this.timerHandle);
      this.timerHandle = null;
    }
  }

  // ---- settings ----

  updateSettings(partial: Partial<Settings>): void {
    this.state.settings = { ...this.state.settings, ...partial };
    this.commit();
  }

  // ---- board snapshot (for UI convenience, avoids callers mutating live state) ----

  boardSnapshot(): CellState[][] {
    const cp = this.state.currentPuzzle;
    return cp ? (cloneBoard(cp.board) as CellState[][]) : [];
  }
}
