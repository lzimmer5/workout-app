import { Router } from "express";
import { z } from "zod";
import type { InValue } from "@libsql/client";
import { db, getOrCreateExerciseId, placeholders } from "../db.js";
import { HttpError, nameSchema, parseId } from "../http.js";

const router = Router();

const sessionInput = z
  .object({
    workoutId: z.number().int().positive().nullable().optional(),
    name: nameSchema,
    startedAt: z.string().datetime(),
    completedAt: z.string().datetime(),
    exercises: z
      .array(
        z.object({
          name: nameSchema,
          sets: z
            .array(
              z.object({
                reps: z.number().int().min(0).max(1000),
                weight: z.number().min(0).max(5000),
              }),
            )
            .min(1),
        }),
      )
      .min(1, "Log at least one set"),
  })
  .refine((s) => s.startedAt <= s.completedAt, "startedAt must be before completedAt");

async function fetchSessions(where: string, args: InValue[], limit: number) {
  const sessions = await db.execute({
    sql: `SELECT id, workout_id, name, started_at, completed_at FROM sessions ${where}
          ORDER BY completed_at DESC LIMIT ?`,
    args: [...args, limit],
  });
  if (sessions.rows.length === 0) return [];

  const ids = sessions.rows.map((s) => Number(s.id));
  const sets = await db.execute({
    sql: `SELECT ss.session_id, ss.exercise_id, ss.exercise_order, e.name, ss.set_number, ss.reps, ss.weight
          FROM session_sets ss JOIN exercises e ON e.id = ss.exercise_id
          WHERE ss.session_id IN (${placeholders(ids.length)})
          ORDER BY ss.session_id, ss.exercise_order, ss.set_number`,
    args: ids,
  });

  return sessions.rows.map((s) => {
    const exercises: { order: number; exerciseId: number; name: string; sets: { setNumber: number; reps: number; weight: number }[] }[] = [];
    for (const row of sets.rows) {
      if (Number(row.session_id) !== Number(s.id)) continue;
      let exercise = exercises.at(-1);
      if (!exercise || exercise.order !== Number(row.exercise_order)) {
        exercise = { order: Number(row.exercise_order), exerciseId: Number(row.exercise_id), name: String(row.name), sets: [] };
        exercises.push(exercise);
      }
      exercise.sets.push({ setNumber: Number(row.set_number), reps: Number(row.reps), weight: Number(row.weight) });
    }
    return {
      id: Number(s.id),
      workoutId: s.workout_id === null ? null : Number(s.workout_id),
      name: String(s.name),
      startedAt: String(s.started_at),
      completedAt: String(s.completed_at),
      exercises: exercises.map(({ order: _order, ...exercise }) => exercise),
    };
  });
}

router.get("/", async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 500);
  res.json(await fetchSessions("", [], limit));
});

router.get("/count", async (req, res) => {
  const since = z.string().datetime().parse(req.query.since);
  const result = await db.execute({
    sql: "SELECT COUNT(*) AS count FROM sessions WHERE completed_at >= ?",
    args: [since],
  });
  res.json({ count: Number(result.rows[0].count) });
});

router.get("/:id", async (req, res) => {
  const [session] = await fetchSessions("WHERE id = ?", [parseId(req.params.id)], 1);
  if (!session) throw new HttpError(404, "Workout not found");
  res.json(session);
});

router.post("/", async (req, res) => {
  const input = sessionInput.parse(req.body);
  const tx = await db.transaction("write");
  let id: number;
  try {
    let workoutId = input.workoutId ?? null;
    if (workoutId !== null) {
      const exists = await tx.execute({ sql: "SELECT 1 FROM workouts WHERE id = ?", args: [workoutId] });
      if (exists.rows.length === 0) workoutId = null;
    }
    const result = await tx.execute({
      sql: "INSERT INTO sessions (workout_id, name, started_at, completed_at) VALUES (?, ?, ?, ?)",
      args: [workoutId, input.name, input.startedAt, input.completedAt],
    });
    id = Number(result.lastInsertRowid);
    for (const [order, exercise] of input.exercises.entries()) {
      const exerciseId = await getOrCreateExerciseId(tx, exercise.name);
      for (const [index, set] of exercise.sets.entries()) {
        await tx.execute({
          sql: `INSERT INTO session_sets (session_id, exercise_id, exercise_order, set_number, reps, weight)
                VALUES (?, ?, ?, ?, ?, ?)`,
          args: [id, exerciseId, order, index + 1, set.reps, set.weight],
        });
      }
    }
    await tx.commit();
  } finally {
    tx.close();
  }
  const [session] = await fetchSessions("WHERE id = ?", [id], 1);
  res.status(201).json(session);
});

router.delete("/:id", async (req, res) => {
  const id = parseId(req.params.id);
  const results = await db.batch(
    [
      { sql: "DELETE FROM session_sets WHERE session_id = ?", args: [id] },
      { sql: "DELETE FROM sessions WHERE id = ?", args: [id] },
    ],
    "write",
  );
  if (results[1].rowsAffected === 0) throw new HttpError(404, "Workout not found");
  res.status(204).end();
});

export default router;
