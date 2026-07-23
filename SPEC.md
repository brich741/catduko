# CatDuko — Game Specification

A single-player, offline, cat-themed logic puzzle for phones, in the spirit of Sudoku / Star Battle. You place cats on a grid so that exactly one cat sits in every row, every column, and every color region, with no two cats touching — not even diagonally. Every generated puzzle is guaranteed to have exactly one solution, and that solution is always reachable by pure logical deduction (no guessing ever required).

This is a personal project: a PWA installed to your own phone's home screen, no accounts, no ads, no app store.

---

## 1. Puzzle Rules

Given an **N×N grid** partitioned into **N contiguous color regions** (one region per row/column count — i.e. an N×N grid always has exactly N regions), place exactly one cat per:

- **Row** — exactly one cat in each row.
- **Column** — exactly one cat in each column.
- **Color region** — exactly one cat in each region. Regions are edge-contiguous (connected via up/down/left/right, not diagonally) but a region's cells do **not** need to share a row or column with each other, and region shapes/sizes vary freely.
- **No adjacency** — no two cats may touch, including diagonally (i.e. no cat may occupy any of the 8 cells surrounding another cat).

There are no pre-filled "given" cats. The puzzle is defined **entirely by the grid size and the region partition** (pure Star-Battle-style puzzle) — solving means using the four rules above to deduce the one valid arrangement.

---

## 2. Puzzle Generation

Generation happens **on-device**, in the browser, on demand — no bundled puzzle packs, no backend.

### 2.1 Algorithm

1. **Generate a random valid solution.** Use randomized backtracking to place N cats on the N×N grid such that no two share a row, share a column, or touch (including diagonally). Shuffle candidate order at each step so different runs produce different solutions.
2. **Grow regions around the solution.** Starting from each of the N solution cats as a seed, grow N contiguous regions via randomized BFS/flood-fill until every cell on the grid belongs to exactly one region and each region contains exactly one seed cat. Randomize growth order/weighting so region shapes vary between puzzles (avoiding overly uniform blob or overly jagged shapes — bias growth to keep region sizes roughly balanced).
3. **Strip the solution.** The generated puzzle is just the grid size + region partition; the solution itself is retained internally (for validation and the completion check) but never shown.
4. **Verify uniqueness.** Run a constraint solver (backtracking with the four rules) to confirm the region partition yields **exactly one** valid solution. Discard and regenerate if not.
5. **Verify pure-logic solvability + grade difficulty.** Run the graded logical solver (§2.2) against the puzzle. It must be able to reach the full solution using only its deduction techniques — never falling back to trial-and-error/backtracking. Discard and regenerate if the logical solver gets stuck before completion. The **highest-tier technique actually required** during the solve determines the puzzle's real difficulty rating.
6. **Match to requested difficulty.** If the resulting difficulty rating matches the level the player requested, use the puzzle. Otherwise discard and retry (see §2.3 for the retry/fallback policy).

### 2.2 Logical Solver — Graded Techniques

The solver applies techniques in increasing tiers, looping until no more progress can be made or the puzzle is fully solved:

| Tier | Technique | Description |
|---|---|---|
| 1 | **Adjacency clearing** | After any cat placement, mark X on all 8 surrounding cells. |
| 1 | **Line/region completion** | If a row, column, or region has only one remaining non-X candidate cell, it must hold a cat — place it. |
| 1 | **Full-line/region exhaustion** | Once a row/column/region has its one cat placed, mark X on all its other cells. |
| 2 | **Region–line intersection** | If all remaining candidates of a region lie within a single row or column, X out the rest of that row/column outside the region (and vice versa: if all remaining candidates of a row/column lie within a single region, X out the rest of that region). |
| 3 | **Subset/fish deduction** | If the remaining candidates of two regions (or two rows/columns) are confined to the same two rows/columns, X out those rows'/columns' other cells outside the two regions (X-wing-style reasoning generalized to regions). |
| 4 | **Chained/combined deduction** | Iterative combination of the above techniques across multiple regions/lines simultaneously, needed to fully resolve the most tightly-constrained puzzles. |

A puzzle "requires tier K" if the solver needs at least one tier-K technique application to make progress at some point, even if most of the puzzle resolves with lower tiers.

### 2.3 Generation Performance & Fallback

- The generator retries (fresh random solution + region growth) in a loop with a generous **total timeout budget (~10 seconds)**, showing a "shuffling puzzle..." loading animation while it works. Puzzle generation is expected to typically complete well under a second; the budget exists purely as a safety margin for unlucky/pathological retries, especially at larger grid sizes.
- If the timeout is hit without finding a valid puzzle at the requested difficulty, no further fallback is needed in practice given the retry budget — treat this as an exceptional/unreachable case in testing rather than a designed UX path.

---

## 3. Difficulty Levels

Four levels, scaling grid size and required solver tier together:

| Level | Grid size | Regions | Max required solver tier |
|---|---|---|---|
| Easy | 5×5 | 5 | Tier 1 |
| Medium | 6×6 – 7×7 | 6–7 | Tier 2 |
| Hard | 8×8 | 8 | Tier 3 |
| Expert | 9×9 – 10×10 | 9–10 | Tier 4 |

Grid size within a level's range (e.g. Medium's 6×6 vs 7×7) is chosen randomly at generation time.

---

## 4. Gameplay / Interaction Model

### 4.1 Cell states
Each cell is in one of three states: **empty**, **X** (marked as "no cat here"), or **cat**.

### 4.2 Touch input
- **Single tap** toggles between **empty ↔ X**. (Tapping an empty cell marks it X; tapping an X'd cell clears it back to empty.)
- **Double tap** toggles between **that cell's current state ↔ cat**. (Double-tapping any non-cat cell places a cat there, overriding whatever mark was present; double-tapping a cat clears it back to empty.)
- Placing a cat does **not** require first clearing an existing X — double-tap always works directly.

### 4.3 Auto-X assist
When a cat is placed, automatically mark X on every cell that placement eliminates: the rest of its row, column, and color region, plus all 8 surrounding neighbor cells — skipping any cell that's already a cat (shouldn't happen in a legal state) and simply overwriting existing X/empty marks. This is a pure convenience layer; it never places cats automatically, only X's. Toggleable in Settings (§7), on by default; when off, placing a cat only places the cat.

### 4.4 Live rule-violation highlighting
The board is checked continuously (not blocking input). If the current set of placed cats violates a rule — two cats share a row/column/region, or two cats are touching (including diagonally) — the offending cats are highlighted (e.g. a red pulse/outline) until the conflict is resolved. Placement is never blocked; this is purely informational.

### 4.5 Hints
A **Hint** button runs the graded logical solver (§2.2) against the current board state and finds the next available deduction. It highlights the relevant cell(s) with a glow and shows a one-line plain-language explanation (e.g. "Only one cell left in this row can hold a cat" or "This region's remaining cells are all in Column 4, so the rest of Column 4 can be marked X"). The hint **shows** the deduction but does not auto-apply it — the player still taps/double-taps to make the move themselves. If the board currently has no cell reachable by the graded solver from its present state (e.g. the player went off a deducible path), the hint explains that no direct deduction is currently available and suggests reviewing existing X-marks.

### 4.6 Undo / redo
Every move (tap, double-tap, and each auto-X placed as a side effect of a cat placement, batched as one undo step) is recorded in an undo/redo stack for the current puzzle. Undo/redo has no fixed depth limit within a puzzle and persists across app close/reopen (see §6).

### 4.7 Timer & move counter
A running timer (mm:ss) and a move counter (counting player-initiated taps/double-taps, not auto-X side effects) are shown during play and in the completion summary. The timer pauses if the app is backgrounded and resumes on return.

### 4.8 Completion
The puzzle is complete when every cell holds either a cat or X consistent with the unique solution and all N cats are correctly placed satisfying all four rules. On completion: a short celebratory animation plays, the timer stops, and the result (time, moves, difficulty) is recorded to stats (§7).

### 4.9 New Puzzle flow
Tapping "New Puzzle" while the current puzzle is unfinished shows a confirmation dialog ("Discard current progress and start a new puzzle?") before generating a fresh puzzle. No confirmation is needed if the current puzzle is already complete.

---

## 5. Visual Design

**Style:** soft pastel flat design — clean flat colors, gently rounded cell/card corners, calm and modern rather than loud or cartoonish.

- **Region colors:** each region gets a distinct pastel fill color from a fixed, hand-picked palette sized for the largest grid (10 colors, for 10 regions max at Expert). Colorblind-friendly patterning is explicitly out of scope for v1 (per product decision) — colors alone distinguish regions.
- **Cat icon:** a simple, minimalist cat silhouette/paw-print style icon rendered in the placed cell, in a color that contrasts cleanly against any region pastel.
- **X mark:** a soft, understated mark (not harsh/red) distinct from the violation-highlight red, since X is a normal deduction tool, not an error.
- **Violation highlight:** a clearly different visual treatment (red pulse/outline) reserved only for live rule-conflict feedback, so it's never confused with a normal X mark.
- **Animations:** a small satisfying "bounce" when a cat is placed, a gentle shake or pulse for conflicts, and a short celebratory animation (e.g. confetti or cat-themed sparkle) on puzzle completion.
- **Dark mode:** supported, following the phone's system `prefers-color-scheme` with a manual override toggle in Settings. Pastel palette gets a dark-mode-appropriate counterpart (muted/deepened region colors against a dark background) rather than simply inverting.
- **Sound:** short, soft sound effects for placing a cat, marking an X, and completing a puzzle; mutable via Settings.
- **Haptics:** light vibration on cat placement and puzzle completion where the device/browser supports the Vibration API; toggleable via Settings.

---

## 6. Data Persistence

No backend, no accounts — everything lives in browser **localStorage** on-device, structured as a small versioned JSON schema so it can evolve safely:

```
catduko:v1 {
  currentPuzzle: {
    difficulty: "easy" | "medium" | "hard" | "expert",
    gridSize: number,
    regions: number[][],        // region id per cell
    solution: [row, col][],     // internal, not shown to player
    board: ("empty"|"x"|"cat")[][],
    moveHistory: Move[],        // full undo/redo stack
    historyIndex: number,
    elapsedSeconds: number,
    startedAt: timestamp,
    completed: boolean
  } | null,
  stats: {
    perDifficulty: {
      [difficulty]: {
        completedCount: number,
        bestTimeSeconds: number | null,
        totalTimeSeconds: number   // for computing average
      }
    },
    totalCompleted: number,
    currentStreakDays: number,
    lastCompletedDate: string | null
  },
  settings: {
    theme: "system" | "light" | "dark",
    soundEnabled: boolean,
    hapticsEnabled: boolean,
    autoXAssistEnabled: boolean
  }
}
```

- **Autosave:** every player move (and resulting auto-X side effects) is written to `currentPuzzle` immediately — no explicit save action, no data loss on closing the tab/app mid-puzzle.
- **One puzzle at a time:** `currentPuzzle` holds at most one in-progress puzzle. Starting a new puzzle (after confirmation, §4.9) overwrites it.
- **Stats persist independently** of the current puzzle and accumulate across app restarts indefinitely.
- **Streak logic:** `currentStreakDays` increments when a puzzle is completed on a calendar day following the previous completion day; resets to 1 if a day is skipped, and to 1 on first-ever completion.

---

## 7. Settings Screen

- Theme: System / Light / Dark.
- Sound effects: on/off.
- Haptic feedback: on/off.
- Auto-X assist (§4.3): on/off. When off, placing a cat only places the cat — no automatic X's on the eliminated row/column/region/neighbors.
- Stats view: completed count, best/average time, and current streak per difficulty.
- (No accounts, no cloud sync, no ads, no in-app purchases — none of that is in scope.)

---

## 8. Technical Architecture

- **App type:** Progressive Web App (PWA) — installable to a phone's home screen via "Add to Home Screen," works fully offline after first load via a service worker caching the app shell/assets.
- **Stack:** Vite + TypeScript, vanilla DOM rendering (no heavy UI framework needed at this scope) with CSS custom properties driving the light/dark pastel theme.
- **Rendering:** the grid is rendered as a DOM grid (CSS Grid) of cell elements rather than canvas, keeping hit-testing, accessibility, and animation straightforward.
- **Offline storage:** `localStorage` per §6 (small JSON payload, well within localStorage limits — no IndexedDB needed at this data volume).
- **No backend, no network calls at runtime.** All puzzle generation and solving happens client-side in JS/TS.
- **Hosting/distribution:** personal use only — run via local dev server (`vite dev`) or a static production build (`vite build`) served locally on the phone's network, or from a simple static host later if desired. No app store submission, no public distribution.

### 8.1 Core modules
- `solutionGenerator` — randomized backtracking solution generator (§2.1 step 1).
- `regionGrower` — randomized BFS region growth from a solution (§2.1 step 2).
- `uniquenessSolver` — backtracking constraint solver used only to verify a unique solution exists (§2.1 step 4).
- `logicalSolver` — graded technique solver (§2.2), used both for generation-time validation/difficulty grading and for the in-game Hint feature (§4.5).
- `gameState` — board state, move history, undo/redo, persistence read/write.
- `ui` — rendering, input handling (tap/double-tap detection), animations, theming.

---

## 9. Edge Cases & Design Decisions Log

- **No pre-filled cats:** puzzles are pure region-partition puzzles; difficulty comes entirely from grid size and region-shape complexity, never from varying how many cells start filled.
- **Guaranteed pure-logic solvability:** the generator rejects any puzzle the graded logical solver can't fully resolve without guessing — this is a hard requirement, not just single-solution uniqueness.
- **Double-tap vs. accidental double-tap:** standard double-tap timing threshold (~300ms) applies; a mis-timed double-tap simply registers as two independent single taps (two X toggles), which is a harmless, easily-correctable outcome.
- **Conflict highlighting vs. hint highlighting:** these must be visually distinct (red pulse for rule violations vs. a positive glow color for hints) so the player never confuses "you made a mistake" with "here's a suggestion."
- **Undo across auto-X:** placing a cat and its resulting auto-X side effects count as a single undo step, so undo feels like undoing "one move," not several.
- **Region palette ceiling:** the fixed palette must support up to 10 simultaneously-distinguishable pastel colors for Expert-level 10×10 puzzles; chosen up front rather than generated procedurally, to keep them curated and pleasant.
- **Timer pause on backgrounding:** prevents inflated times if the player switches apps mid-solve.
- **Streak definition:** based on calendar days with at least one completed puzzle, not consecutive puzzles — missing a whole day breaks it, but multiple completions in one day only count once toward the streak.

---

## 10. Out of Scope (v1)

- Accounts, cloud sync, multi-device play.
- Ads or monetization of any kind.
- Colorblind-specific patterning (deferred; may revisit later).
- Bundled/pre-generated puzzle packs (generation is fully on-device).
- Multiple simultaneous in-progress puzzles / puzzle library.
- App store distribution.
