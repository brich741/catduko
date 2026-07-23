import { beforeEach, describe, expect, it, vi } from "vitest";
import { GameState } from "./gameState";

beforeEach(() => {
  localStorage.clear();
  vi.useRealTimers();
});

describe("GameState", () => {
  it("starts a new puzzle with an empty board and resets history/timer state", () => {
    const gs = new GameState();
    gs.startNewPuzzle("easy");
    expect(gs.puzzle).not.toBeNull();
    expect(gs.puzzle!.completed).toBe(false);
    expect(gs.puzzle!.historyIndex).toBe(0);
    expect(gs.moveCount).toBe(0);
    expect(gs.canUndo).toBe(false);
    expect(gs.canRedo).toBe(false);
    gs.stopTimer();
  });

  it("single tap toggles empty <-> x and counts as one move", () => {
    const gs = new GameState();
    gs.startNewPuzzle("easy");
    gs.handleTap(0, 0);
    expect(gs.puzzle!.board[0][0]).toBe("x");
    expect(gs.moveCount).toBe(1);
    gs.handleTap(0, 0);
    expect(gs.puzzle!.board[0][0]).toBe("empty");
    expect(gs.moveCount).toBe(2);
    gs.stopTimer();
  });

  it("double tap places a cat and auto-Xs row/col/region/neighbors as one batched move", () => {
    const gs = new GameState();
    gs.startNewPuzzle("easy");
    const [r, c] = [gs.puzzle!.solution[0].row, gs.puzzle!.solution[0].col];
    gs.handleDoubleTap(r, c);
    expect(gs.puzzle!.board[r][c]).toBe("cat");
    expect(gs.moveCount).toBe(1); // batched as a single undo step
    // rest of the row should be X now
    for (let cc = 0; cc < gs.puzzle!.gridSize; cc++) {
      if (cc !== c) expect(gs.puzzle!.board[r][cc]).toBe("x");
    }
    gs.stopTimer();
  });

  it("double tap on a cell that isn't part of the solution is rejected", () => {
    const gs = new GameState();
    gs.startNewPuzzle("easy");
    const solutionKeys = new Set(gs.puzzle!.solution.map((c) => `${c.row},${c.col}`));
    const n = gs.puzzle!.gridSize;
    let wrongRow = -1;
    let wrongCol = -1;
    outer: for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (!solutionKeys.has(`${r},${c}`)) {
          wrongRow = r;
          wrongCol = c;
          break outer;
        }
      }
    }
    expect(gs.isIllegalCatPlacement(wrongRow, wrongCol)).toBe(true);
    gs.handleDoubleTap(wrongRow, wrongCol);
    expect(gs.puzzle!.board[wrongRow][wrongCol]).toBe("empty");
    expect(gs.moveCount).toBe(0);
    gs.stopTimer();
  });

  it("double tap on a cell that is part of the solution places a cat", () => {
    const gs = new GameState();
    gs.startNewPuzzle("easy");
    const { row, col } = gs.puzzle!.solution[0];
    expect(gs.isIllegalCatPlacement(row, col)).toBe(false);
    gs.handleDoubleTap(row, col);
    expect(gs.puzzle!.board[row][col]).toBe("cat");
    gs.stopTimer();
  });

  it("double tap on a cat clears it back to empty", () => {
    const gs = new GameState();
    gs.startNewPuzzle("easy");
    const { row: r, col: c } = gs.puzzle!.solution[0];
    gs.handleDoubleTap(r, c);
    gs.handleDoubleTap(r, c);
    expect(gs.puzzle!.board[r][c]).toBe("empty");
    gs.stopTimer();
  });

  it("undo/redo reverts and reapplies a full batched move", () => {
    const gs = new GameState();
    gs.startNewPuzzle("easy");
    const { row: r, col: c } = gs.puzzle!.solution[0];
    gs.handleDoubleTap(r, c);
    expect(gs.puzzle!.board[r][c]).toBe("cat");
    gs.undo();
    expect(gs.puzzle!.board[r][c]).toBe("empty");
    expect(gs.canRedo).toBe(true);
    gs.redo();
    expect(gs.puzzle!.board[r][c]).toBe("cat");
    gs.stopTimer();
  });

  it("completing the puzzle by placing all solution cats records stats and stops the timer", () => {
    const gs = new GameState();
    gs.startNewPuzzle("easy");
    const solution = gs.puzzle!.solution;
    for (const { row, col } of solution) {
      gs.handleDoubleTap(row, col);
    }
    expect(gs.puzzle!.completed).toBe(true);
    expect(gs.stats.perDifficulty.easy.completedCount).toBe(1);
    expect(gs.stats.totalCompleted).toBe(1);
    expect(gs.stats.currentStreakDays).toBe(1);
  });

  it("persists across GameState instances via localStorage", () => {
    const gs1 = new GameState();
    gs1.startNewPuzzle("medium");
    const puzzleGridSize = gs1.puzzle!.gridSize;
    gs1.handleTap(0, 0);
    gs1.stopTimer();

    const gs2 = new GameState();
    expect(gs2.puzzle).not.toBeNull();
    expect(gs2.puzzle!.gridSize).toBe(puzzleGridSize);
    expect(gs2.puzzle!.board[0][0]).toBe("x");
    gs2.stopTimer();
  });

  it("getHint returns a deduction without mutating the board", () => {
    const gs = new GameState();
    gs.startNewPuzzle("medium");
    const before = JSON.stringify(gs.puzzle!.board);
    const hint = gs.getHint();
    expect(hint).not.toBeNull();
    expect(JSON.stringify(gs.puzzle!.board)).toBe(before);
    gs.stopTimer();
  });
});
