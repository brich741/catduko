import { describe, expect, it } from "vitest";
import { generateRandomSolution } from "./solutionGenerator";
import { growRegions } from "./regionGrower";
import { countSolutions } from "./uniquenessSolver";

describe("countSolutions", () => {
  it("finds at least one solution (the planted one) for a freshly grown region set", () => {
    const n = 7;
    const solution = generateRandomSolution(n);
    const regions = growRegions(n, solution);
    const count = countSolutions(regions, n, 5);
    expect(count).toBeGreaterThanOrEqual(1);
  });
});
