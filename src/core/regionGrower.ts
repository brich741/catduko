import type { Coord, RegionGrid } from "./types";
import { shuffled } from "./random";
import { inBounds } from "./boardOps";
import { isRegionContiguous, orthoNeighbors, sameSolution } from "./regionOps";
import { findSolutions } from "./uniquenessSolver";

const ORTHO = [
  { dr: -1, dc: 0 },
  { dr: 1, dc: 0 },
  { dr: 0, dc: -1 },
  { dr: 0, dc: 1 },
];

interface FrontierEntry {
  id: number;
  row: number;
  col: number;
}

/**
 * Grows N contiguous (edge-connected) regions from the N solution cats.
 *
 * Uses a single shared frontier of (region, candidate-cell) pairs, picking
 * uniformly at random each step rather than round-robin. This produces
 * naturally varied, organic region shapes and sizes - which, empirically,
 * also yields dramatically higher unique-solution rates than strict
 * round-robin balancing (random Star Battle partitions with near-uniform
 * region sizes are almost never uniquely solvable). Growth still stays
 * connected and self-balances loosely since bigger regions simply have more
 * frontier cells competing for the same random draw, not systematically more.
 */
export function growRegions(n: number, solution: Coord[], rng: () => number = Math.random): RegionGrid {
  const regions: RegionGrid = Array.from({ length: n }, () => new Array<number>(n).fill(-1));
  solution.forEach((seed, id) => {
    regions[seed.row][seed.col] = id;
  });

  // Give every region a second cell up front so none can end up as a lone square.
  let claimed = 0;
  for (const id of shuffled(solution.map((_, i) => i), rng)) {
    const seed = solution[id];
    const free = shuffled(ORTHO, rng)
      .map(({ dr, dc }) => ({ row: seed.row + dr, col: seed.col + dc }))
      .filter((p) => inBounds(n, p.row, p.col) && regions[p.row][p.col] === -1);
    if (free.length > 0) {
      regions[free[0].row][free[0].col] = id;
      claimed++;
    }
  }

  let frontier: FrontierEntry[] = [];
  const pushFrontier = (id: number, r: number, c: number) => {
    for (const { dr, dc } of ORTHO) {
      const nr = r + dr;
      const nc = c + dc;
      if (inBounds(n, nr, nc) && regions[nr][nc] === -1) frontier.push({ id, row: nr, col: nc });
    }
  };
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) if (regions[r][c] !== -1) pushFrontier(regions[r][c], r, c);
  }

  // Large grids: give each region a random growth appetite so sizes end up
  // very uneven. Near-uniform partitions on 11x11+ are almost never uniquely
  // solvable; skewed ones are far more often.
  const weights = n >= 11 ? solution.map(() => 0.05 + rng() ** 4 * 8) : null;

  let unassigned = n * n - n - claimed;
  let guard = 0;
  const guardLimit = n * n * 50;

  while (unassigned > 0 && guard++ < guardLimit) {
    if (frontier.length === 0) {
      repairPass(n, regions, rng);
      unassigned = countUnassigned(regions, n);
      // rebuild frontier from the now-larger assigned area
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          if (regions[r][c] !== -1) pushFrontier(regions[r][c], r, c);
        }
      }
      continue;
    }
    const idx = pickFrontierIndex(frontier, weights, rng);
    const entry = frontier[idx];
    frontier.splice(idx, 1);
    if (regions[entry.row][entry.col] !== -1) continue; // stale, already claimed
    regions[entry.row][entry.col] = entry.id;
    unassigned--;
    pushFrontier(entry.id, entry.row, entry.col);
  }

  return regions;
}

function pickFrontierIndex(frontier: FrontierEntry[], weights: number[] | null, rng: () => number): number {
  if (!weights) return Math.floor(rng() * frontier.length);
  let total = 0;
  for (const e of frontier) total += weights[e.id];
  let x = rng() * total;
  for (let i = 0; i < frontier.length; i++) {
    x -= weights[frontier[i].id];
    if (x <= 0) return i;
  }
  return frontier.length - 1;
}

function countUnassigned(regions: RegionGrid, n: number): number {
  let count = 0;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (regions[r][c] === -1) count++;
  return count;
}

function repairPass(n: number, regions: RegionGrid, rng: () => number): void {
  const cells = shuffled(
    Array.from({ length: n * n }, (_, i) => ({ row: Math.floor(i / n), col: i % n })),
    rng
  );
  for (const { row, col } of cells) {
    if (regions[row][col] !== -1) continue;
    const neighborRegions: number[] = [];
    for (const { dr, dc } of ORTHO) {
      const nr = row + dr;
      const nc = col + dc;
      if (inBounds(n, nr, nc) && regions[nr][nc] !== -1) neighborRegions.push(regions[nr][nc]);
    }
    if (neighborRegions.length > 0) {
      regions[row][col] = neighborRegions[Math.floor(rng() * neighborRegions.length)];
    }
  }
}

/**
 * If `regions` doesn't yet have a unique solution, tries to fix it in place
 * by reassigning individual non-seed boundary cells: find a cell that holds
 * a cat in some alternate (spurious) solution, and move it into a
 * neighboring region that already holds another of that same alternate
 * solution's cats - directly invalidating that alternate solution by giving
 * its region two cats, while leaving the planted solution (whose cats always
 * stay put as region seeds) untouched. Mutates `regions` in place. Returns
 * true if the partition ends up uniquely solvable.
 */
export function repairForUniqueness(
  n: number,
  regions: RegionGrid,
  plantedSolution: Coord[],
  rng: () => number = Math.random,
  maxAttempts = 60
): boolean {
  const seedKeys = new Set(plantedSolution.map((c) => `${c.row},${c.col}`));

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const solutions = findSolutions(regions, n, 2);
    if (solutions.length <= 1) return true;

    const alt = solutions.find((s) => !sameSolution(s, plantedSolution)) ?? solutions[1];
    const movableAltCells = shuffled(
      alt.filter((c) => !seedKeys.has(`${c.row},${c.col}`)),
      rng
    );

    let repaired = false;
    for (const cell of movableAltCells) {
      const curRegion = regions[cell.row][cell.col];
      const candidateRegions = shuffled(
        Array.from(
          new Set(
            orthoNeighbors(n, cell)
              .map((nb) => regions[nb.row][nb.col])
              .filter((r) => r !== curRegion)
          )
        ),
        rng
      );

      for (const candRegion of candidateRegions) {
        const altHasOtherCatThere = alt.some(
          (c) => !(c.row === cell.row && c.col === cell.col) && regions[c.row][c.col] === candRegion
        );
        if (!altHasOtherCatThere) continue;

        regions[cell.row][cell.col] = candRegion;
        if (isRegionContiguous(n, regions, curRegion)) {
          repaired = true;
          break;
        }
        regions[cell.row][cell.col] = curRegion; // revert, would have split the old region
      }
      if (repaired) break;
    }

    if (!repaired) return false;
  }

  return findSolutions(regions, n, 2).length === 1;
}

/**
 * Evens out region sizes on an already-unique puzzle: repeatedly moves a
 * non-seed boundary square from a large region into a smaller neighboring
 * region, keeping the move only if every region stays contiguous (2+ squares)
 * and the puzzle stays uniquely solvable. Stops when the largest region is at
 * most `maxSize`. Mutates `regions` in place; returns whether the target was hit.
 */
export function rebalanceRegions(
  n: number,
  regions: RegionGrid,
  plantedSolution: Coord[],
  rng: () => number,
  maxSize: number,
  steps = 4000
): boolean {
  const seedKeys = new Set(plantedSolution.map((c) => `${c.row},${c.col}`));
  const sizes = new Array<number>(n).fill(0);
  for (const row of regions) for (const id of row) sizes[id]++;

  for (let step = 0; step < steps; step++) {
    let big = 0;
    for (let i = 1; i < n; i++) if (sizes[i] > sizes[big]) big = i;
    if (sizes[big] <= maxSize) return true;

    // pick a random boundary square of a region bigger than the target
    const row = Math.floor(rng() * n);
    const col = Math.floor(rng() * n);
    const cur = regions[row][col];
    if (sizes[cur] <= maxSize || seedKeys.has(`${row},${col}`)) continue;
    const options = Array.from(
      new Set(orthoNeighbors(n, { row, col }).map((nb) => regions[nb.row][nb.col]).filter((r) => r !== cur))
    ).filter((r) => sizes[r] + 1 < sizes[cur]);
    if (options.length === 0) continue;
    const next = options[Math.floor(rng() * options.length)];

    regions[row][col] = next;
    if (isRegionContiguous(n, regions, cur) && findSolutions(regions, n, 2).length === 1) {
      sizes[cur]--;
      sizes[next]++;
    } else {
      regions[row][col] = cur;
    }
  }
  return false;
}

/**
 * Random-walks a uniquely solvable partition: each step moves a non-seed
 * boundary square to a neighboring region, keeping contiguity, 2..maxSize
 * squares per region and uniqueness. Used to shuffle the layout looking for
 * one the logical solver can finish. Mutates `regions`; returns moves made.
 */
export function wanderUnique(
  n: number,
  regions: RegionGrid,
  plantedSolution: Coord[],
  rng: () => number,
  maxSize: number,
  tries: number
): number {
  const seedKeys = new Set(plantedSolution.map((c) => `${c.row},${c.col}`));
  const sizes = new Array<number>(n).fill(0);
  for (const row of regions) for (const id of row) sizes[id]++;
  let moves = 0;
  for (let i = 0; i < tries; i++) {
    const row = Math.floor(rng() * n);
    const col = Math.floor(rng() * n);
    if (seedKeys.has(`${row},${col}`)) continue;
    const cur = regions[row][col];
    if (sizes[cur] <= 2) continue;
    const options = Array.from(
      new Set(orthoNeighbors(n, { row, col }).map((nb) => regions[nb.row][nb.col]).filter((r) => r !== cur))
    ).filter((r) => sizes[r] < maxSize);
    if (options.length === 0) continue;
    const next = options[Math.floor(rng() * options.length)];
    regions[row][col] = next;
    if (isRegionContiguous(n, regions, cur) && findSolutions(regions, n, 2).length === 1) {
      sizes[cur]--;
      sizes[next]++;
      moves++;
    } else {
      regions[row][col] = cur;
    }
  }
  return moves;
}
