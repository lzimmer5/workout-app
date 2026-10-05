import { Router } from "express";
import { db } from "../db.js";
import { HttpError, parseId } from "../http.js";

const router = Router();

router.get("/", async (_req, res) => {
  const result = await db.execute(
    `SELECT e.id, e.name, COUNT(DISTINCT ss.session_id) AS session_count, MAX(s.completed_at) AS last_performed_at
     FROM exercises e
     LEFT JOIN session_sets ss ON ss.exercise_id = e.id
     LEFT JOIN sessions s ON s.id = ss.session_id
     GROUP BY e.id
     ORDER BY e.name COLLATE NOCASE`,
  );
  res.json(
    result.rows.map((r) => ({
      id: Number(r.id),
      name: String(r.name),
      sessionCount: Number(r.session_count),
      lastPerformedAt: r.last_performed_at === null ? null : String(r.last_performed_at),
    })),
  );
});

/** Epley formula: an estimate of the one-rep max from a set of `reps` at `weight`. */
function estimatedOneRepMax(weight: number, reps: number) {
  if (reps === 0) return 0;
  return reps === 1 ? weight : weight * (1 + reps / 30);
}

router.get("/:id/progress", async (req, res) => {
  const id = parseId(req.params.id);
  const exercise = await db.execute({ sql: "SELECT id, name FROM exercises WHERE id = ?", args: [id] });
  if (exercise.rows.length === 0) throw new HttpError(404, "Exercise not found");

  const sets = await db.execute({
    sql: `SELECT s.id AS session_id, s.name AS session_name, s.completed_at, ss.reps, ss.weight
          FROM session_sets ss JOIN sessions s ON s.id = ss.session_id
          WHERE ss.exercise_id = ?
          ORDER BY s.completed_at, ss.exercise_order, ss.set_number`,
    args: [id],
  });

  const sessions = new Map<number, { sessionId: number; sessionName: string; date: string; sets: { reps: number; weight: number }[] }>();
  for (const row of sets.rows) {
    const sessionId = Number(row.session_id);
    if (!sessions.has(sessionId)) {
      sessions.set(sessionId, { sessionId, sessionName: String(row.session_name), date: String(row.completed_at), sets: [] });
    }
    sessions.get(sessionId)!.sets.push({ reps: Number(row.reps), weight: Number(row.weight) });
  }

  const round = (n: number) => Math.round(n * 10) / 10;
  res.json({
    exercise: { id, name: String(exercise.rows[0].name) },
    sessions: [...sessions.values()].map((s) => {
      const bestWeight = Math.max(...s.sets.map((set) => set.weight));
      return {
        ...s,
        bestWeight,
        repsAtBestWeight: Math.max(...s.sets.filter((set) => set.weight === bestWeight).map((set) => set.reps)),
        estimatedOneRepMax: round(Math.max(...s.sets.map((set) => estimatedOneRepMax(set.weight, set.reps)))),
        volume: round(s.sets.reduce((sum, set) => sum + set.reps * set.weight, 0)),
        totalReps: s.sets.reduce((sum, set) => sum + set.reps, 0),
      };
    }),
  });
});

export default router;
