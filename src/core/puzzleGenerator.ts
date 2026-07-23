import type { Difficulty, Puzzle } from "./types";
import { DIFFICULTY_GRID_SIZES, DIFFICULTY_TIER } from "./types";
import { generateRandomSolution } from "./solutionGenerator";
import { growRegions, repairForUniqueness } from "./regionGrower";
import { hasUniqueSolution } from "./uniquenessSolver";
import { solvePuzzle } from "./logicalSolver";
import { pickRandom } from "./random";

const GENERATION_BUDGET_MS = 10_000;

export class PuzzleGenerationTimeoutError extends Error {
  constructor(difficulty: Difficulty, attempts: number) {
    super(`Could not generate a "${difficulty}" puzzle within the time budget after ${attempts} attempts.`);
    this.name = "PuzzleGenerationTimeoutError";
  }
}

/**
 * Implements §2.1-2.3: generate a random solution, grow regions around it,
 * verify uniqueness + pure-logic solvability, and grade difficulty by the
 * highest solver tier actually required. Retries until a puzzle matching the
 * requested difficulty is found, or the time budget runs out.
 */
export function generatePuzzle(difficulty: Difficulty, rng: () => number = Math.random): Puzzle {
  const requiredTier = DIFFICULTY_TIER[difficulty];
  const start = Date.now();
  let attempts = 0;

  while (Date.now() - start < GENERATION_BUDGET_MS) {
    attempts++;
    const gridSize = pickRandom(DIFFICULTY_GRID_SIZES[difficulty], rng);

    const solution = generateRandomSolution(gridSize, rng);
    const regions = growRegions(gridSize, solution, rng);

    if (!hasUniqueSolution(regions, gridSize)) {
      if (!repairForUniqueness(gridSize, regions, solution, rng)) continue;
    }

    const result = solvePuzzle(regions, gridSize);
    if (!result.solved) continue;
    if (result.maxTier !== requiredTier) continue;

    return { difficulty, gridSize, regions, solution };
  }

  throw new PuzzleGenerationTimeoutError(difficulty, attempts);
}
