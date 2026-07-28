import type { Difficulty } from "../core/types";
import type { Settings } from "../core/schema";
import type { Deduction } from "../core/logicalSolver";
import { GameState } from "../core/gameState";
import { BoardView } from "./boardView";
import { initTheme, updateTheme } from "./theme";
import { playComplete, playMarkX, playPlaceCat } from "./sound";
import { HAPTIC_CAT_PLACED, HAPTIC_COMPLETE, vibrate } from "./haptics";
import { burstConfetti } from "./confetti";
import { DIFFICULTY_LABEL, DIFFICULTY_SUBTITLE, formatAverage, formatTime } from "./format";
import { ruleLegendHTML } from "./icons";

type Screen = "start" | "game" | "settings";

interface ConfirmState {
  message: string;
  onConfirm: () => void;
}

const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard", "expert"];
const THEMES: Settings["theme"][] = ["system", "light", "dark"];

export class App {
  private gameState = new GameState();
  private boardView: BoardView | null = null;
  private screen: Screen = "start";
  private hint: Deduction | null = null;
  private hintNoneMessage: string | null = null;
  private confirmDialog: ConfirmState | null = null;
  private generating = false;
  private generationError: string | null = null;
  private celebratedFor: number | null = null;
  private completionDismissed = false;
  private builtGridSize: number | null = null;
  private invalidAttempt: { row: number; col: number } | null = null;
  private invalidAttemptTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(private root: HTMLElement) {
    initTheme(() => this.gameState.settings.theme);
    this.screen = this.gameState.puzzle ? "game" : "start";
    if (this.gameState.puzzle && !this.gameState.puzzle.completed) this.gameState.startTimer();

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.gameState.stopTimer();
      } else if (this.gameState.puzzle && !this.gameState.puzzle.completed) {
        this.gameState.startTimer();
      }
    });

    this.gameState.subscribe(() => this.onGameStateChange());
    this.render();
  }

  private onGameStateChange(): void {
    const puzzle = this.gameState.puzzle;
    if (puzzle?.completed && this.celebratedFor !== puzzle.startedAt) {
      this.celebratedFor = puzzle.startedAt;
      this.completionDismissed = false;
      this.celebrate();
    }
    this.render();
  }

  private celebrate(): void {
    burstConfetti();
    if (this.gameState.settings.soundEnabled) playComplete();
    if (this.gameState.settings.hapticsEnabled) vibrate(HAPTIC_COMPLETE);
  }

  private clearHint(): void {
    this.hint = null;
    this.hintNoneMessage = null;
  }

  // ---- navigation ----

  private goToDifficultyPicker(): void {
    const puzzle = this.gameState.puzzle;
    if (puzzle && !puzzle.completed) {
      this.confirmDialog = {
        message: "Discard current progress and start a new puzzle?",
        onConfirm: () => {
          this.confirmDialog = null;
          this.screen = "start";
          this.render();
        },
      };
      this.render();
    } else {
      this.screen = "start";
      this.render();
    }
  }

  private beginGeneration(difficulty: Difficulty): void {
    this.screen = "game";
    this.generating = true;
    this.generationError = null;
    if (this.invalidAttemptTimeout) clearTimeout(this.invalidAttemptTimeout);
    this.invalidAttempt = null;
    this.render();

    // Defer the (synchronous, CPU-bound) generation two frames so the
    // "shuffling puzzle..." loading state actually gets to paint first.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        try {
          this.gameState.startNewPuzzle(difficulty);
          this.clearHint();
          this.completionDismissed = false;
          this.celebratedFor = null;
          this.builtGridSize = null;
        } catch (err) {
          this.generationError = err instanceof Error ? err.message : String(err);
        }
        this.generating = false;
        this.render();
      });
    });
  }

  // ---- render dispatch ----

  private render(): void {
    if (this.screen === "start") this.renderStart();
    else if (this.screen === "settings") this.renderSettings();
    else this.renderGame();
  }

  private renderStart(): void {
    this.root.innerHTML = `
      <div class="screen start-screen">
        <div class="brand">
          <h1>🐾 CatDuko</h1>
          <p>One cat per row, column &amp; region. No two may touch.</p>
        </div>
        <div class="difficulty-grid">
          ${DIFFICULTIES.map(
            (d) => `
            <button class="difficulty-card" data-difficulty="${d}">
              <span class="label">${DIFFICULTY_LABEL[d]}</span>
              <span class="sub">${DIFFICULTY_SUBTITLE[d]}</span>
            </button>`
          ).join("")}
        </div>
        <button class="settings-link" data-action="settings">Settings &amp; Stats</button>
      </div>
    `;

    this.root.querySelectorAll<HTMLButtonElement>("[data-difficulty]").forEach((btn) => {
      btn.addEventListener("click", () => this.beginGeneration(btn.dataset.difficulty as Difficulty));
    });
    this.root.querySelector("[data-action='settings']")?.addEventListener("click", () => {
      this.screen = "settings";
      this.render();
    });
  }

  private renderGame(): void {
    if (this.generating || !this.gameState.puzzle) {
      this.root.innerHTML = `
        <div class="screen loading-screen">
          <div class="spinner"></div>
          <p>Shuffling puzzle...</p>
          ${this.generationError ? `<p style="color:var(--danger)">${this.generationError}</p>` : ""}
        </div>
      `;
      return;
    }

    const puzzle = this.gameState.puzzle;
    if (this.builtGridSize !== puzzle.gridSize || !this.root.querySelector(".board")) {
      this.buildGameScreenShell();
      this.builtGridSize = puzzle.gridSize;
    }
    this.refreshGameScreen();
  }

  private buildGameScreenShell(): void {
    this.root.innerHTML = `
      <div class="screen game-screen">
        <div class="top-bar">
          <button class="btn btn-icon" data-action="back" aria-label="Back">←</button>
          <div class="stats-row">
            <div class="stat-block"><span class="stat-label">Time</span><span class="stat-value" data-el="timer">00:00</span></div>
            <div class="stat-block"><span class="stat-label">Moves</span><span class="stat-value" data-el="moves">0</span></div>
          </div>
          <button class="btn btn-icon" data-action="settings" aria-label="Settings">⚙️</button>
        </div>
        <div class="difficulty-badge" data-el="difficulty"></div>
        <div class="cat-progress-row">
          <div class="cat-progress-pill">🐱 <span data-el="cat-progress">0/0</span></div>
        </div>
        ${ruleLegendHTML()}
        <div class="board-wrap"><div class="board"></div></div>
        <div data-el="hint-slot"></div>
        <div class="action-row">
          <button class="btn btn-icon" data-action="undo" aria-label="Undo">↩️</button>
          <button class="btn btn-icon" data-action="redo" aria-label="Redo">↪️</button>
          <button class="btn btn-primary" data-action="hint">Hint</button>
          <button class="btn" data-action="new">New Puzzle</button>
        </div>
      </div>
    `;

    this.root.querySelector("[data-action='back']")!.addEventListener("click", () => this.goToDifficultyPicker());
    this.root.querySelector("[data-action='settings']")!.addEventListener("click", () => {
      this.screen = "settings";
      this.render();
    });
    this.root.querySelector("[data-action='undo']")!.addEventListener("click", () => {
      this.clearHint();
      this.gameState.undo();
    });
    this.root.querySelector("[data-action='redo']")!.addEventListener("click", () => {
      this.clearHint();
      this.gameState.redo();
    });
    this.root.querySelector("[data-action='hint']")!.addEventListener("click", () => this.showHint());
    this.root.querySelector("[data-action='new']")!.addEventListener("click", () => this.goToDifficultyPicker());

    const boardContainer = this.root.querySelector<HTMLElement>(".board")!;
    this.boardView = new BoardView(boardContainer, {
      onTap: (r, c) => this.handleTap(r, c),
      onDoubleTap: (r, c) => this.handleDoubleTap(r, c),
    });
    const puzzle = this.gameState.puzzle!;
    this.boardView.build(puzzle.gridSize, puzzle.regions, this.isDark());
  }

  private handleTap(row: number, col: number): void {
    this.clearHint();
    const before = this.gameState.puzzle!.board[row][col];
    this.gameState.handleTap(row, col);
    const after = this.gameState.puzzle!.board[row][col];
    if (before === "empty" && after === "x" && this.gameState.settings.soundEnabled) playMarkX();
  }

  private handleDoubleTap(row: number, col: number): void {
    this.clearHint();
    const before = this.gameState.puzzle!.board[row][col];
    if (before !== "cat" && this.gameState.isIllegalCatPlacement(row, col)) {
      this.flashInvalidAttempt(row, col);
      return;
    }
    this.gameState.handleDoubleTap(row, col);
    const after = this.gameState.puzzle!.board[row][col];
    if (after === "cat" && before !== "cat") {
      if (this.gameState.settings.soundEnabled) playPlaceCat();
      if (this.gameState.settings.hapticsEnabled) vibrate(HAPTIC_CAT_PLACED);
    }
  }

  private flashInvalidAttempt(row: number, col: number): void {
    if (this.invalidAttemptTimeout) clearTimeout(this.invalidAttemptTimeout);
    this.invalidAttempt = { row, col };
    this.render();
    this.invalidAttemptTimeout = setTimeout(() => {
      this.invalidAttempt = null;
      this.invalidAttemptTimeout = null;
      this.render();
    }, 500);
  }

  private showHint(): void {
    const deduction = this.gameState.getHint();
    if (deduction) {
      this.hint = deduction;
      this.hintNoneMessage = null;
    } else {
      this.hint = null;
      this.hintNoneMessage = "No direct deduction is available from here right now — try reviewing your X marks.";
    }
    this.render();
  }

  private isDark(): boolean {
    return document.documentElement.dataset.theme === "dark";
  }

  private refreshGameScreen(): void {
    const puzzle = this.gameState.puzzle!;

    this.root.querySelector("[data-el='timer']")!.textContent = formatTime(puzzle.elapsedSeconds);
    this.root.querySelector("[data-el='moves']")!.textContent = String(this.gameState.moveCount);
    this.root.querySelector(
      "[data-el='difficulty']"
    )!.textContent = `${DIFFICULTY_LABEL[puzzle.difficulty]} · ${puzzle.gridSize}×${puzzle.gridSize}`;

    const catsPlaced = puzzle.board.reduce((n, row) => n + row.filter((s) => s === "cat").length, 0);
    this.root.querySelector("[data-el='cat-progress']")!.textContent = `${catsPlaced}/${puzzle.gridSize}`;

    this.root.querySelector<HTMLButtonElement>("[data-action='undo']")!.disabled = !this.gameState.canUndo;
    this.root.querySelector<HTMLButtonElement>("[data-action='redo']")!.disabled = !this.gameState.canRedo;

    const conflictKeys = new Set(this.gameState.conflicts.map((c) => `${c.row},${c.col}`));
    for (const c of this.gameState.contradictions) conflictKeys.add(`${c.row},${c.col}`);
    if (this.invalidAttempt) conflictKeys.add(`${this.invalidAttempt.row},${this.invalidAttempt.col}`);
    const hintKeys = new Set((this.hint?.highlight ?? []).map((c) => `${c.row},${c.col}`));
    this.boardView!.update(puzzle.board, conflictKeys, hintKeys);
    this.boardView!.updateColors(puzzle.regions, this.isDark());

    const hintSlot = this.root.querySelector<HTMLElement>("[data-el='hint-slot']")!;
    const message = this.hint?.explanation ?? this.hintNoneMessage;
    if (message) {
      hintSlot.innerHTML = `
        <div class="hint-banner">
          <span class="icon">💡</span>
          <span>${message}</span>
          <button data-action="dismiss-hint" aria-label="Dismiss hint">✕</button>
        </div>`;
      hintSlot.querySelector("[data-action='dismiss-hint']")!.addEventListener("click", () => {
        this.clearHint();
        this.render();
      });
    } else {
      hintSlot.innerHTML = "";
    }

    this.renderOverlays();
  }

  private renderOverlays(): void {
    this.root.querySelectorAll(".overlay").forEach((el) => el.remove());

    if (this.confirmDialog) {
      const overlay = document.createElement("div");
      overlay.className = "overlay";
      overlay.innerHTML = `
        <div class="dialog">
          <h3>New puzzle?</h3>
          <p>${this.confirmDialog.message}</p>
          <div class="dialog-actions">
            <button class="btn" data-action="cancel">Cancel</button>
            <button class="btn btn-primary" data-action="confirm">Discard</button>
          </div>
        </div>`;
      overlay.querySelector("[data-action='cancel']")!.addEventListener("click", () => {
        this.confirmDialog = null;
        this.render();
      });
      overlay.querySelector("[data-action='confirm']")!.addEventListener("click", () => this.confirmDialog!.onConfirm());
      this.root.appendChild(overlay);
      return;
    }

    const puzzle = this.gameState.puzzle;
    if (puzzle?.completed && !this.completionDismissed) {
      const overlay = document.createElement("div");
      overlay.className = "overlay";
      overlay.innerHTML = `
        <div class="dialog">
          <div class="completion-emoji">🐱🎉</div>
          <h3>Puzzle complete!</h3>
          <div class="completion-stats">
            <div class="stat"><span class="value">${formatTime(puzzle.elapsedSeconds)}</span><span class="label">Time</span></div>
            <div class="stat"><span class="value">${this.gameState.moveCount}</span><span class="label">Moves</span></div>
            <div class="stat"><span class="value">${DIFFICULTY_LABEL[puzzle.difficulty]}</span><span class="label">Difficulty</span></div>
          </div>
          <div class="dialog-actions">
            <button class="btn" data-action="close">Close</button>
            <button class="btn btn-primary" data-action="new">New Puzzle</button>
          </div>
        </div>`;
      overlay.querySelector("[data-action='close']")!.addEventListener("click", () => {
        this.completionDismissed = true;
        this.render();
      });
      overlay.querySelector("[data-action='new']")!.addEventListener("click", () => {
        this.completionDismissed = true;
        this.screen = "start";
        this.render();
      });
      this.root.appendChild(overlay);
    }
  }

  private renderSettings(): void {
    const settings = this.gameState.settings;
    const stats = this.gameState.stats;

    this.root.innerHTML = `
      <div class="screen settings-screen">
        <div class="settings-header">
          <button class="btn btn-icon" data-action="back" aria-label="Back">←</button>
          <h2>Settings</h2>
        </div>

        <div class="settings-section">
          <div class="settings-row">
            <span class="row-label">Theme</span>
            <div class="segmented">
              ${THEMES.map(
                (t) =>
                  `<button data-theme-choice="${t}" class="${settings.theme === t ? "active" : ""}">${
                    t.charAt(0).toUpperCase() + t.slice(1)
                  }</button>`
              ).join("")}
            </div>
          </div>
          <div class="settings-row">
            <span class="row-label">Sound effects</span>
            <button class="switch ${settings.soundEnabled ? "on" : ""}" data-action="toggle-sound" aria-label="Toggle sound"></button>
          </div>
          <div class="settings-row">
            <span class="row-label">Haptic feedback</span>
            <button class="switch ${settings.hapticsEnabled ? "on" : ""}" data-action="toggle-haptics" aria-label="Toggle haptics"></button>
          </div>
          <div class="settings-row">
            <span class="row-label">Auto-X assist</span>
            <button class="switch ${settings.autoXAssistEnabled ? "on" : ""}" data-action="toggle-auto-x" aria-label="Toggle auto-X assist"></button>
          </div>
        </div>

        <div class="streak-banner">
          <span style="font-size:1.5rem">🔥</span>
          <div>
            <div class="count">${stats.currentStreakDays}</div>
            <div style="color:var(--text-muted); font-size:0.8rem;">day streak</div>
          </div>
        </div>

        <div class="settings-section">
          <table class="stats-table">
            <thead>
              <tr><th>Difficulty</th><th>Solved</th><th>Best</th><th>Average</th></tr>
            </thead>
            <tbody>
              ${DIFFICULTIES.map((d) => {
                const s = stats.perDifficulty[d];
                return `<tr>
                  <td>${DIFFICULTY_LABEL[d]}</td>
                  <td>${s.completedCount}</td>
                  <td>${s.bestTimeSeconds !== null ? formatTime(s.bestTimeSeconds) : "--:--"}</td>
                  <td>${formatAverage(s.totalTimeSeconds, s.completedCount)}</td>
                </tr>`;
              }).join("")}
            </tbody>
          </table>
        </div>
        <p style="text-align:center; color:var(--text-muted); font-size:0.8rem;">${stats.totalCompleted} puzzles solved in total</p>
      </div>
    `;

    this.root.querySelector("[data-action='back']")!.addEventListener("click", () => {
      this.screen = this.gameState.puzzle ? "game" : "start";
      this.render();
    });
    this.root.querySelectorAll<HTMLButtonElement>("[data-theme-choice]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const theme = btn.dataset.themeChoice as Settings["theme"];
        updateTheme(theme);
        this.gameState.updateSettings({ theme });
      });
    });
    this.root.querySelector("[data-action='toggle-sound']")!.addEventListener("click", () => {
      this.gameState.updateSettings({ soundEnabled: !settings.soundEnabled });
    });
    this.root.querySelector("[data-action='toggle-haptics']")!.addEventListener("click", () => {
      this.gameState.updateSettings({ hapticsEnabled: !settings.hapticsEnabled });
    });
    this.root.querySelector("[data-action='toggle-auto-x']")!.addEventListener("click", () => {
      this.gameState.updateSettings({ autoXAssistEnabled: !settings.autoXAssistEnabled });
    });
  }
}
