import type { PersistedState } from "./schema";
import { createDefaultPersistedState, createDefaultSettings, createDefaultStats } from "./schema";

const STORAGE_KEY = "catduko:v1";

/**
 * Loads persisted state from localStorage (§6). Defensive against missing
 * keys / corrupt JSON / a future schema drifting - always returns a
 * complete, usable PersistedState by falling back to defaults for anything
 * missing or malformed, rather than throwing.
 */
export function loadState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultPersistedState();
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    return {
      currentPuzzle: parsed.currentPuzzle ?? null,
      stats: {
        ...createDefaultStats(),
        ...parsed.stats,
        perDifficulty: { ...createDefaultStats().perDifficulty, ...parsed.stats?.perDifficulty },
      },
      settings: { ...createDefaultSettings(), ...parsed.settings },
    };
  } catch {
    return createDefaultPersistedState();
  }
}

export function saveState(state: PersistedState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage unavailable/full (e.g. private browsing) - best effort only
  }
}

export function clearState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
