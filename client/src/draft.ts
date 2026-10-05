// The workout in progress lives in localStorage so a page refresh or closed tab at the gym
// doesn't lose anything. It is only sent to the server when the user taps Finish.

export interface DraftSet {
  weight: string;
  reps: string;
  done: boolean;
}

export interface DraftExercise {
  key: string;
  name: string;
  targetSets: number | null;
  targetReps: number | null;
  lastSummary: string | null;
  sets: DraftSet[];
}

export interface Draft {
  workoutId: number | null;
  name: string;
  startedAt: string;
  exercises: DraftExercise[];
}

const KEY = "workout-app:active-workout";

export function loadDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

export function saveDraft(draft: Draft) {
  try {
    localStorage.setItem(KEY, JSON.stringify(draft));
  } catch {
    // Storage full or blocked; the workout still works for this page view.
  }
}

export function clearDraft() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Ignore.
  }
}

export function newKey() {
  return Math.random().toString(36).slice(2, 10);
}
