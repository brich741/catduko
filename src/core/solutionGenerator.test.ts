import { describe, expect, it } from "vitest";
import { generateRandomSolution } from "./solutionGenerator";

function isValidSolution(n: number, solution: { row: number; col: number }[]): boolean {
  if (solution.length !== n) return false;
  const cols = new Set(solution.map((c) => c.col));
  if (cols.size !== n) return false;
  for (let i = 0; i < solution.length; i++) {
    for (let j = i + 1; j < solution.length; j++) {
      const a = solution[i];
      const b = solution[j];
      if (Math.abs(a.row - b.row) <= 1 && Math.abs(a.col - b.col) <= 1) return false;
    }
  }
  return true;
}

describe("generateRandomSolution", () => {
  it.each([4, 5, 6, 7, 8, 9, 10])("produces a valid non-adjacent permutation for n=%i", (n) => {
    for (let i = 0; i < 20; i++) {
      const solution = generateRandomSolution(n);
      expect(isValidSolution(n, solution)).toBe(true);
    }
  });

  it("produces varied solutions across runs", () => {
    const n = 8;
    const seen = new Set<string>();
    for (let i = 0; i < 30; i++) {
      seen.add(JSON.stringify(generateRandomSolution(n)));
    }
    expect(seen.size).toBeGreaterThan(1);
  });
});
