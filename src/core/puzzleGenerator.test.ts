import { describe, expect, it } from "vitest";
import { generatePuzzle } from "./puzzleGenerator";
import { hasUniqueSolution } from "./uniquenessSolver";
import { solvePuzzle } from "./logicalSolver";
import { DIFFICULTY_TIER, type Difficulty } from "./types";

const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard", "expert"];

describe("generatePuzzle", () => {
  it.each(DIFFICULTIES)("generates a valid, unique, pure-logic-solvable %s puzzle", (difficulty) => {
    const puzzle = generatePuzzle(difficulty);

    expect(puzzle.difficulty).toBe(difficulty);
    expect(hasUniqueSolution(puzzle.regions, puzzle.gridSize)).toBe(true);

    const result = solvePuzzle(puzzle.regions, puzzle.gridSize);
    expect(result.solved).toBe(true);
    expect(result.maxTier).toBe(DIFFICULTY_TIER[difficulty]);

    // the solver's found solution must match the planted one (uniqueness
    // guarantees there's only one to find)
    const solvedCats = new Set(
      result.board.flatMap((row, r) => row.map((cell, c) => (cell === "cat" ? `${r},${c}` : null)).filter(Boolean))
    );
    const plantedCats = new Set(puzzle.solution.map((c) => `${c.row},${c.col}`));
    expect(solvedCats).toEqual(plantedCats);
  }, 20_000);
});
