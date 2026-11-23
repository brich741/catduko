import { describe, expect, it } from "vitest";
import { GameState } from "./gameState";
import { hasContradiction } from "./logicalSolver";
import type { Difficulty } from "./types";

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Simulates undirected play (random legal double-taps, not the puzzle's
 * actual solution) across many puzzles per difficulty. Placing a cat must
 * never leave any row/column/region with no cat and no candidate left
 * (§4.2's wouldCreateContradiction guard); clearing a cat can legitimately
 * leave one (its old auto-X cascade isn't reverted), but when it does, the
 * board must always surface it via contradictions (§4.4) rather than
 * leaving the player looking at a silently-impossible board.
 */
describe("board integrity under random legal play", () => {
  const difficulties: Difficulty[] = ["easy", "medium", "hard", "expert", "master"];

  for (const difficulty of difficulties) {
    it(`${difficulty}: placing never contradicts; any contradiction is always surfaced`, () => {
      for (let puzzleIdx = 0; puzzleIdx < 8; puzzleIdx++) {
        localStorage.clear();
        const rng = mulberry32(puzzleIdx * 7919 + difficulty.length);
        const gs = new GameState();
        gs.startNewPuzzle(difficulty);
        const n = gs.puzzle!.gridSize;

        let rejectedInARow = 0;
        for (let attempt = 0; attempt < 500 && rejectedInARow < n * n; attempt++) {
          if (gs.puzzle!.completed) break;
          const row = Math.floor(rng() * n);
          const col = Math.floor(rng() * n);
          const wasCat = gs.puzzle!.board[row][col] === "cat";
          const contradictedBefore = hasContradiction(gs.puzzle!.board, gs.puzzle!.regions, n);
          const before = JSON.stringify(gs.puzzle!.board);
          gs.handleDoubleTap(row, col);
          const after = JSON.stringify(gs.puzzle!.board);
          if (before === after) {
            rejectedInARow++;
            continue;
          }
          rejectedInARow = 0;

          const contradicted = hasContradiction(gs.puzzle!.board, gs.puzzle!.regions, n);
          if (wasCat) {
            // Clearing a cat can legitimately leave stale X's behind; if it
            // does, it must always be visible via `contradictions`.
            if (contradicted) expect(gs.contradictions.length).toBeGreaterThan(0);
          } else if (!contradictedBefore) {
            // Placing a cat must never be what introduces a contradiction.
            // (If the board was already contradictory - e.g. from an earlier
            // clear leaving stale X's - a later unrelated placement isn't
            // obligated to resolve it.)
            expect(contradicted).toBe(false);
          }
        }
        gs.stopTimer();
      }
    });
  }
});
