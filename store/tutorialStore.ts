// ============================================================
// Tutorial Store — Zustand state machine (no immer)
// ============================================================
import { create } from "zustand";
import {
  ALL_STEPS,
  CHAPTER_OFFSETS,
  STEPS_PER_CHAPTER,
  type TutorialStep,
} from "@/lib/tutorial/steps";
import { stopSpeech } from "@/lib/tutorial/voice";

// ============================================================
// Tutorial Game Config — forgiving scenario for first-timers
// ============================================================
export const TUTORIAL_GAME_CONFIG = {
  target: 18,
  totalBalls: 6,
  wicketsRemaining: 5,
  batsmanArchetype: "accumulator" as const,
  batsmanName: "Practice Bot",
  nonStrikerArchetype: "accumulator" as const,
  nonStrikerName: "Stand-In",
  batsmanConfidence: 30,
  seed: 20260412,
};

// ============================================================
// Types
// ============================================================
export type TutorialPhase = "idle" | "chapter_card" | "step" | "free_play" | "complete";

interface TutorialState {
  active: boolean;
  phase: TutorialPhase;
  /** Chapter index 0-3 */
  chapterIndex: number;
  /** Step index within the current chapter */
  stepIndex: number;
  /** Flat index into ALL_STEPS (0-18) */
  globalStepIndex: number;
  /** Whether the player has completed the required action for this step */
  canAdvance: boolean;
  /** IDs of steps the player has completed */
  completedSteps: Set<string>;
  /** True while a ghost demo animation should play */
  demoPlaying: boolean;
  voiceEnabled: boolean;
  launchedFrom: "home_button" | "new_player_prompt" | null;
  /** Fielder positions snapshotted when a drag-action step is entered */
  _fielderSnapshot: Array<{ id: number; x: number; y: number }>;
  /** Cleanup fn for the gameStore subscription */
  _unsubscribe: (() => void) | null;
}

interface TutorialActions {
  startTutorial: (from: "home_button" | "new_player_prompt") => void;
  advanceStep: () => void;
  goBack: () => void;
  markActionDone: () => void;
  skipChapter: () => void;
  skipAll: () => void;
  enterFreePlay: () => void;
  completeTutorial: () => void;
  toggleVoice: () => void;
  demoCycleComplete: () => void;
  /** Called by TutorialOverlay when ChapterCard finishes */
  chapterCardDone: () => void;
}

type TutorialStore = TutorialState & TutorialActions;

// ============================================================
// Helpers
// ============================================================
function stepFromGlobalIndex(globalIdx: number): {
  chapterIndex: number;
  stepIndex: number;
  step: TutorialStep;
} {
  const step = ALL_STEPS[globalIdx];
  const chapterIndex = step.chapter;
  const stepIndex = globalIdx - CHAPTER_OFFSETS[chapterIndex];
  return { chapterIndex, stepIndex, step };
}

function isFirstStepOfChapter(globalIdx: number): boolean {
  return CHAPTER_OFFSETS.includes(globalIdx);
}

// ============================================================
// Store
// ============================================================
export const useTutorialStore = create<TutorialStore>((set, get) => ({
  // ── Initial state ──────────────────────────────────────────
  active: false,
  phase: "idle",
  chapterIndex: 0,
  stepIndex: 0,
  globalStepIndex: 0,
  canAdvance: false,
  completedSteps: new Set<string>(),
  demoPlaying: false,
  voiceEnabled: true,
  launchedFrom: null,
  _fielderSnapshot: [],
  _unsubscribe: null,

  // ── startTutorial ─────────────────────────────────────────
  startTutorial(from) {
    // Clean up any previous subscription
    get()._unsubscribe?.();

    // Start the game with tutorial config (lazy import avoids circular deps at module level)
    // We import inline inside the action, which is safe in Zustand stores.
    import("@/store/gameStore").then(({ useGameStore }) => {
      useGameStore.getState().startGame(TUTORIAL_GAME_CONFIG);

      // Subscribe to game state changes to detect required player actions
      const unsubscribe = useGameStore.subscribe(
        (gameState, prevGameState) => {
          const s = get();
          if (!s.active || s.phase !== "step") return;

          const currentStep = ALL_STEPS[s.globalStepIndex];
          const req = currentStep?.requiresAction;
          if (!req || s.canAdvance) return;

          switch (req) {
            case "drag_any_fielder": {
              const snapshot = s._fielderSnapshot;
              const moved = gameState.field.fielders.some((f) => {
                const snap = snapshot.find((sf) => sf.id === f.id);
                if (!snap) return false;
                return (
                  Math.abs(f.position.x - snap.x) > 1 ||
                  Math.abs(f.position.y - snap.y) > 1
                );
              });
              if (moved) get().markActionDone();
              break;
            }
            case "select_length": {
              if (gameState.currentDelivery.length !== null) get().markActionDone();
              break;
            }
            case "select_variation": {
              if (gameState.currentDelivery.variation !== null) get().markActionDone();
              break;
            }
            case "select_line": {
              if (gameState.currentDelivery.line !== null) get().markActionDone();
              break;
            }
            case "select_full_delivery": {
              const { length, variation, line } = gameState.currentDelivery;
              if (length && variation && line) get().markActionDone();
              break;
            }
            case "bowl_delivery": {
              if (gameState.ballLog.length > prevGameState.ballLog.length) {
                get().markActionDone();
              }
              break;
            }
            default:
              break;
          }
        }
      );

      // Take initial fielder snapshot for drag detection
      const fielders = useGameStore.getState().field.fielders;
      const snapshot = fielders.map((f) => ({
        id: f.id,
        x: f.position.x,
        y: f.position.y,
      }));

      const { chapterIndex, stepIndex, step } = stepFromGlobalIndex(0);

      set({
        active: true,
        phase: "chapter_card",
        chapterIndex,
        stepIndex,
        globalStepIndex: 0,
        canAdvance: step.requiresAction === null,
        completedSteps: new Set(),
        demoPlaying: false,
        launchedFrom: from,
        _fielderSnapshot: snapshot,
        _unsubscribe: unsubscribe,
      });
    });
  },

  // ── chapterCardDone ────────────────────────────────────────
  chapterCardDone() {
    const { globalStepIndex } = get();
    const { step } = stepFromGlobalIndex(globalStepIndex);

    // Snapshot fielders when entering a drag step
    let newSnapshot = get()._fielderSnapshot;
    if (step.requiresAction === "drag_any_fielder") {
      import("@/store/gameStore").then(({ useGameStore }) => {
        const fielders = useGameStore.getState().field.fielders;
        set({
          _fielderSnapshot: fielders.map((f) => ({
            id: f.id,
            x: f.position.x,
            y: f.position.y,
          })),
        });
      });
    }

    set({
      phase: "step",
      demoPlaying: step.demoType !== null,
      canAdvance: step.requiresAction === null,
      _fielderSnapshot: newSnapshot,
    });
  },

  // ── advanceStep ───────────────────────────────────────────
  advanceStep() {
    const s = get();
    if (!s.canAdvance) return;

    const currentStep = ALL_STEPS[s.globalStepIndex];

    // Mark this step as complete
    const nextCompleted = new Set(s.completedSteps);
    nextCompleted.add(currentStep.id);

    const nextGlobal = s.globalStepIndex + 1;

    // Past the last step → free play
    if (nextGlobal >= ALL_STEPS.length) {
      set({ completedSteps: nextCompleted });
      get().enterFreePlay();
      return;
    }

    const { chapterIndex, stepIndex, step } = stepFromGlobalIndex(nextGlobal);

    // Crossed into a new chapter → show chapter card first
    const crossedChapter = isFirstStepOfChapter(nextGlobal);

    set({
      globalStepIndex: nextGlobal,
      chapterIndex,
      stepIndex,
      completedSteps: nextCompleted,
      phase: crossedChapter ? "chapter_card" : "step",
      canAdvance: crossedChapter ? true : step.requiresAction === null,
      demoPlaying: crossedChapter ? false : step.demoType !== null,
    });

    // Snapshot fielders when we land on a drag step (not via chapter card)
    if (!crossedChapter && step.requiresAction === "drag_any_fielder") {
      import("@/store/gameStore").then(({ useGameStore }) => {
        const fielders = useGameStore.getState().field.fielders;
        set({
          _fielderSnapshot: fielders.map((f) => ({
            id: f.id,
            x: f.position.x,
            y: f.position.y,
          })),
        });
      });
    }
  },

  // ── goBack ────────────────────────────────────────────────
  goBack() {
    const s = get();
    if (s.globalStepIndex <= 0) return;

    const prevGlobal = s.globalStepIndex - 1;
    const { chapterIndex, stepIndex, step } = stepFromGlobalIndex(prevGlobal);

    set({
      globalStepIndex: prevGlobal,
      chapterIndex,
      stepIndex,
      phase: "step",
      // Always allow advancing on a previous step (they've already done it or it was skippable)
      canAdvance: true,
      demoPlaying: step.demoType !== null,
    });
  },

  // ── markActionDone ────────────────────────────────────────
  markActionDone() {
    set({ canAdvance: true });
  },

  // ── skipChapter ───────────────────────────────────────────
  skipChapter() {
    const s = get();
    const currentChapter = s.chapterIndex;

    // Find the first step of the next chapter
    const nextChapterOffset = CHAPTER_OFFSETS[currentChapter + 1];

    // If there's no next chapter → free play
    if (nextChapterOffset === undefined) {
      get().enterFreePlay();
      return;
    }

    const { chapterIndex, stepIndex, step } = stepFromGlobalIndex(nextChapterOffset);

    set({
      globalStepIndex: nextChapterOffset,
      chapterIndex,
      stepIndex,
      phase: "chapter_card",
      canAdvance: true,
      demoPlaying: false,
    });
  },

  // ── skipAll ───────────────────────────────────────────────
  skipAll() {
    stopSpeech();
    get()._unsubscribe?.();

    if (typeof window !== "undefined") {
      localStorage.setItem("deathover_has_played", "1");
    }

    set({
      active: false,
      phase: "complete",
      _unsubscribe: null,
    });
  },

  // ── enterFreePlay ─────────────────────────────────────────
  enterFreePlay() {
    stopSpeech();
    set({ phase: "free_play" });
  },

  // ── completeTutorial ─────────────────────────────────────
  completeTutorial() {
    stopSpeech();
    get()._unsubscribe?.();

    if (typeof window !== "undefined") {
      localStorage.setItem("deathover_has_played", "1");
    }

    set({
      active: false,
      phase: "complete",
      _unsubscribe: null,
    });
  },

  // ── toggleVoice ───────────────────────────────────────────
  toggleVoice() {
    const next = !get().voiceEnabled;
    if (!next) stopSpeech();
    set({ voiceEnabled: next });
  },

  // ── demoCycleComplete ────────────────────────────────────
  demoCycleComplete() {
    set({ demoPlaying: false });
  },
}));

// ============================================================
// Selector helpers for components
// ============================================================

export function getCurrentStep(): TutorialStep | null {
  const { active, globalStepIndex } = useTutorialStore.getState();
  if (!active) return null;
  return ALL_STEPS[globalStepIndex] ?? null;
}

export function getStepsInCurrentChapter(): TutorialStep[] {
  const { chapterIndex } = useTutorialStore.getState();
  return ALL_STEPS.filter((s) => s.chapter === chapterIndex);
}

export function getTotalStepsInChapter(chapterIndex: number): number {
  return STEPS_PER_CHAPTER[chapterIndex] ?? 0;
}
