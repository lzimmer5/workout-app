import { Router } from "express";
import { z } from "zod";
import type { InValue, Transaction } from "@libsql/client";
import { db, getOrCreateExerciseId, placeholders } from "../db.js";
import { HttpError, nameSchema, parseId } from "../http.js";

const router = Router();

const workoutInput = z.object({
  name: nameSchema,
  exercises: z
    .array(
      z.object({
        name: nameSchema,
        targetSets: z.number().int().min(1).max(20),
        targetReps: z.number().int().min(1).max(100),
      }),
    )
    .min(1, "Add at least one exercise")
    .max(30),
});
type WorkoutInput = z.infer<typeof workoutInput>;

async function fetchWorkouts(where = "", args: InValue[] = []) {
  const workouts = await db.execute({
    sql: `SELECT w.id, w.name, w.created_at, w.updated_at,
            (SELECT MAX(s.completed_at) FROM sessions s WHERE s.workout_id = w.id) AS last_performed_at
          FROM workouts w ${where}
          ORDER BY w.updated_at DESC`,
    args,
  });
  if (workouts.rows.length === 0) return [];

  const ids = workouts.rows.map((w) => Number(w.id));
  const exercises = await db.execute({
    sql: `SELECT we.workout_id, we.exercise_id, e.name, we.target_sets, we.target_reps
          FROM workout_exercises we JOIN exercises e ON e.id = we.exercise_id
          WHERE we.workout_id IN (${placeholders(ids.length)})
          ORDER BY we.position`,
    args: ids,
  });

  return workouts.rows.map((w) => ({
    id: Number(w.id),
    name: String(w.name),
    createdAt: String(w.created_at),
    updatedAt: String(w.updated_at),
    lastPerformedAt: w.last_performed_at === null ? null : String(w.last_performed_at),
    exercises: exercises.rows
      .filter((e) => Number(e.workout_id) === Number(w.id))
      .map((e) => ({
        exerciseId: Number(e.exercise_id),
        name: String(e.name),
        targetSets: Number(e.target_sets),
        targetReps: Number(e.target_reps),
      })),
  }));
}

async function insertExercises(tx: Transaction, workoutId: number, exercises: WorkoutInput["exercises"]) {
  for (const [position, exercise] of exercises.entries()) {
    const exerciseId = await getOrCreateExerciseId(tx, exercise.name);
    await tx.execute({
      sql: `INSERT INTO workout_exercises (workout_id, exercise_id, position, target_sets, target_reps)
            VALUES (?, ?, ?, ?, ?)`,
      args: [workoutId, exerciseId, position, exercise.targetSets, exercise.targetReps],
    });
  }
}

router.get("/", async (_req, res) => {
  res.json(await fetchWorkouts());
});

// Includes the sets from the last time each exercise was logged, to prefill the active workout.
router.get("/:id", async (req, res) => {
  const id = parseId(req.params.id);
  const [workout] = await fetchWorkouts("WHERE w.id = ?", [id]);
  if (!workout) throw new HttpError(404, "Workout not found");

  const exerciseIds = [...new Set(workout.exercises.map((e) => e.exerciseId))];
  const lastSets = await db.execute({
    sql: `SELECT ss.exercise_id, ss.reps, ss.weight, s.completed_at
          FROM session_sets ss JOIN sessions s ON s.id = ss.session_id
          WHERE ss.exercise_id IN (${placeholders(exerciseIds.length)})
            AND ss.session_id = (
              SELECT ss2.session_id FROM session_sets ss2 JOIN sessions s2 ON s2.id = ss2.session_id
              WHERE ss2.exercise_id = ss.exercise_id
              ORDER BY s2.completed_at DESC LIMIT 1)
          ORDER BY ss.exercise_order, ss.set_number`,
    args: exerciseIds,
  });

  res.json({
    ...workout,
    exercises: workout.exercises.map((e) => {
      const rows = lastSets.rows.filter((r) => Number(r.exercise_id) === e.exerciseId);
      return {
        ...e,
        lastDate: rows.length ? String(rows[0].completed_at) : null,
        lastSets: rows.map((r) => ({ reps: Number(r.reps), weight: Number(r.weight) })),
      };
    }),
  });
});

router.post("/", async (req, res) => {
  const input = workoutInput.parse(req.body);
  const now = new Date().toISOString();
  const tx = await db.transaction("write");
  let id: number;
  try {
    const result = await tx.execute({
      sql: "INSERT INTO workouts (name, created_at, updated_at) VALUES (?, ?, ?)",
      args: [input.name, now, now],
    });
    id = Number(result.lastInsertRowid);
    await insertExercises(tx, id, input.exercises);
    await tx.commit();
  } finally {
    tx.close();
  }
  const [workout] = await fetchWorkouts("WHERE w.id = ?", [id]);
  res.status(201).json(workout);
});

router.put("/:id", async (req, res) => {
  const id = parseId(req.params.id);
  const input = workoutInput.parse(req.body);
  const tx = await db.transaction("write");
  try {
    const result = await tx.execute({
      sql: "UPDATE workouts SET name = ?, updated_at = ? WHERE id = ?",
      args: [input.name, new Date().toISOString(), id],
    });
    if (result.rowsAffected === 0) throw new HttpError(404, "Workout not found");
    await tx.execute({ sql: "DELETE FROM workout_exercises WHERE workout_id = ?", args: [id] });
    await insertExercises(tx, id, input.exercises);
    await tx.commit();
  } finally {
    tx.close();
  }
  const [workout] = await fetchWorkouts("WHERE w.id = ?", [id]);
  res.json(workout);
});

// Deleting a routine keeps its logged sessions in history; they just stop pointing at it.
router.delete("/:id", async (req, res) => {
  const id = parseId(req.params.id);
  const results = await db.batch(
    [
      { sql: "UPDATE sessions SET workout_id = NULL WHERE workout_id = ?", args: [id] },
      { sql: "DELETE FROM workout_exercises WHERE workout_id = ?", args: [id] },
      { sql: "DELETE FROM workouts WHERE id = ?", args: [id] },
    ],
    "write",
  );
  if (results[2].rowsAffected === 0) throw new HttpError(404, "Workout not found");
  res.status(204).end();
});

export default router;
