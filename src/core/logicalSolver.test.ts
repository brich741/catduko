import { describe, expect, it } from "vitest";
import { generatePuzzle } from "./puzzleGenerator";
import { findNextDeduction, hasContradiction } from "./logicalSolver";
import { createEmptyBoard } from "./boardOps";

describe("logicalSolver", () => {
  it("findNextDeduction always returns a step for a freshly generated puzzle's empty board", () => {
    const puzzle = generatePuzzle("medium");
    const board = createEmptyBoard(puzzle.gridSize);
    const deduction = findNextDeduction(board, puzzle.regions, puzzle.gridSize);
    expect(deduction).not.toBeNull();
    expect(deduction!.tier).toBeGreaterThanOrEqual(1);
    expect(deduction!.explanation.length).toBeGreaterThan(0);
  });

  it("detects a contradiction when a group is starved of candidates", () => {
    const puzzle = generatePuzzle("easy");
    const board = createEmptyBoard(puzzle.gridSize);
    // Mark an entire row X - now that row has zero candidates, a contradiction.
    for (let c = 0; c < puzzle.gridSize; c++) board[0][c] = "x";
    expect(hasContradiction(board, puzzle.regions, puzzle.gridSize)).toBe(true);
    expect(findNextDeduction(board, puzzle.regions, puzzle.gridSize)).toBeNull();
  });

  it("returns null once the board is already fully solved", () => {
    const puzzle = generatePuzzle("easy");
    const board = createEmptyBoard(puzzle.gridSize);
    for (const { row, col } of puzzle.solution) board[row][col] = "cat";
    // not marking X's, but every group already has its cat so no group is "unsolved"
    const deduction = findNextDeduction(board, puzzle.regions, puzzle.gridSize);
    expect(deduction).toBeNull();
  });
});
