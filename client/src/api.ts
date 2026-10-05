export interface SetEntry {
  reps: number;
  weight: number;
}

export interface WorkoutExercise {
  exerciseId: number;
  name: string;
  targetSets: number;
  targetReps: number;
}

export interface Workout {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
  lastPerformedAt: string | null;
  exercises: WorkoutExercise[];
}

export interface WorkoutDetail extends Workout {
  exercises: (WorkoutExercise & { lastDate: string | null; lastSets: SetEntry[] })[];
}

export interface WorkoutInput {
  name: string;
  exercises: { name: string; targetSets: number; targetReps: number }[];
}

export interface Session {
  id: number;
  workoutId: number | null;
  name: string;
  startedAt: string;
  completedAt: string;
  exercises: { exerciseId: number; name: string; sets: (SetEntry & { setNumber: number })[] }[];
}

export interface SessionInput {
  workoutId: number | null;
  name: string;
  startedAt: string;
  completedAt: string;
  exercises: { name: string; sets: SetEntry[] }[];
}

export interface ExerciseSummary {
  id: number;
  name: string;
  sessionCount: number;
  lastPerformedAt: string | null;
}

export interface ExerciseProgress {
  exercise: { id: number; name: string };
  sessions: {
    sessionId: number;
    sessionName: string;
    date: string;
    sets: SetEntry[];
    bestWeight: number;
    repsAtBestWeight: number;
    estimatedOneRepMax: number;
    volume: number;
    totalReps: number;
  }[];
}

// Empty in development (Vite proxies /api); set VITE_API_URL if the API is hosted separately.
const API_BASE = import.meta.env.VITE_API_URL ?? "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}/api${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body.error) message = body.error;
    } catch {
      // Non-JSON error body; keep the generic message.
    }
    throw new Error(message);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

export const api = {
  listWorkouts: () => request<Workout[]>("/workouts"),
  getWorkout: (id: number) => request<WorkoutDetail>(`/workouts/${id}`),
  createWorkout: (input: WorkoutInput) => request<Workout>("/workouts", { method: "POST", body: JSON.stringify(input) }),
  updateWorkout: (id: number, input: WorkoutInput) =>
    request<Workout>(`/workouts/${id}`, { method: "PUT", body: JSON.stringify(input) }),
  deleteWorkout: (id: number) => request<void>(`/workouts/${id}`, { method: "DELETE" }),

  listSessions: (limit = 50) => request<Session[]>(`/sessions?limit=${limit}`),
  countSessionsSince: (since: Date) =>
    request<{ count: number }>(`/sessions/count?since=${encodeURIComponent(since.toISOString())}`),
  createSession: (input: SessionInput) => request<Session>("/sessions", { method: "POST", body: JSON.stringify(input) }),
  deleteSession: (id: number) => request<void>(`/sessions/${id}`, { method: "DELETE" }),

  listExercises: () => request<ExerciseSummary[]>("/exercises"),
  getExerciseProgress: (id: number) => request<ExerciseProgress>(`/exercises/${id}/progress`),
};
