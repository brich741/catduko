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

    if (hasSingleCellRegion(regions, gridSize)) continue; // cheap check first

    if (!hasUniqueSolution(regions, gridSize)) {
      if (!repairForUniqueness(gridSize, regions, solution, rng, gridSize >= 11 ? 12 : 60)) continue;
    }

    if (hasSingleCellRegion(regions, gridSize)) continue;

    const result = solvePuzzle(regions, gridSize);
    if (!result.solved) continue;
    // With no 1-cell regions nothing is solvable from an empty board by tier-1
    // alone, so easy accepts tier 1-2. Tier-3/4 12x12 grids are very rare,
    // so master accepts tier 2+ (the 12x12 size carries the difficulty). Other difficulties need an exact match.
    const tierOk =
      difficulty === "easy"
        ? result.maxTier <= requiredTier + 1
        : difficulty === "master"
          ? result.maxTier >= 2
          : result.maxTier === requiredTier;
    if (!tierOk) continue;

    return { difficulty, gridSize, regions, solution };
  }

  throw new PuzzleGenerationTimeoutError(difficulty, attempts);
}

/** True if any region consists of just one cell (every region must span 2+ squares). */
function hasSingleCellRegion(regions: number[][], n: number): boolean {
  const counts = new Array<number>(n).fill(0);
  for (const row of regions) for (const id of row) counts[id]++;
  return counts.some((c) => c < 2);
}
