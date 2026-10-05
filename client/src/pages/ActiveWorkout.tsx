import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, type SessionInput, type WorkoutDetail } from "../api";
import { ErrorMessage, Loading } from "../components/Status";
import { clearDraft, loadDraft, newKey, saveDraft, type Draft, type DraftExercise, type DraftSet } from "../draft";
import { formatSet, formatShortDate } from "../format";

function draftFromWorkout(workout: WorkoutDetail): Draft {
  return {
    workoutId: workout.id,
    name: workout.name,
    startedAt: new Date().toISOString(),
    exercises: workout.exercises.map((e) => ({
      key: newKey(),
      name: e.name,
      targetSets: e.targetSets,
      targetReps: e.targetReps,
      lastSummary: e.lastSets.length
        ? `${formatShortDate(e.lastDate!)}: ${e.lastSets.map(formatSet).join(", ")}`
        : null,
      // Prefill with last time's weights (if any) and the target reps.
      sets: Array.from({ length: e.targetSets }, (_, i) => {
        const last = e.lastSets[i] ?? e.lastSets.at(-1);
        return { weight: last ? String(last.weight) : "", reps: String(e.targetReps), done: false };
      }),
    })),
  };
}

function useElapsed(startedAt: string | undefined) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  if (!startedAt) return "";
  const seconds = Math.max(0, Math.floor((now - Date.parse(startedAt)) / 1000));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h ? `${h}:` : ""}${String(m).padStart(h ? 2 : 1, "0")}:${String(s).padStart(2, "0")}`;
}

export default function ActiveWorkout() {
  const workoutId = Number(useParams().id);
  const navigate = useNavigate();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [workout, setWorkout] = useState<WorkoutDetail>();
  const [otherDraft, setOtherDraft] = useState<Draft | null>(null);
  const [loadError, setLoadError] = useState<string>();
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [newExercise, setNewExercise] = useState("");
  const elapsed = useElapsed(draft?.startedAt);

  useEffect(() => {
    const existing = loadDraft();
    if (existing?.workoutId === workoutId) {
      setDraft(existing);
      return;
    }
    let cancelled = false;
    api.getWorkout(workoutId).then(
      (w) => {
        if (cancelled) return;
        if (existing) {
          // A different workout is already in progress; let the user decide.
          setWorkout(w);
          setOtherDraft(existing);
        } else {
          setDraft(draftFromWorkout(w));
        }
      },
      (e: unknown) => !cancelled && setLoadError(e instanceof Error ? e.message : String(e)),
    );
    return () => {
      cancelled = true;
    };
  }, [workoutId]);

  useEffect(() => {
    if (draft) saveDraft(draft);
  }, [draft]);

  const updateExercise = (key: string, update: (e: DraftExercise) => DraftExercise) =>
    setDraft((d) => d && { ...d, exercises: d.exercises.map((e) => (e.key === key ? update(e) : e)) });

  const updateSet = (key: string, index: number, patch: Partial<DraftSet>) =>
    updateExercise(key, (e) => ({ ...e, sets: e.sets.map((s, i) => (i === index ? { ...s, ...patch } : s)) }));

  function addExercise() {
    const name = newExercise.trim();
    if (!name) return;
    setDraft(
      (d) =>
        d && {
          ...d,
          exercises: [
            ...d.exercises,
            { key: newKey(), name, targetSets: null, targetReps: null, lastSummary: null, sets: [{ weight: "", reps: "", done: false }] },
          ],
        },
    );
    setNewExercise("");
  }

  function cancelWorkout() {
    if (!confirm("Discard this workout? Nothing will be saved.")) return;
    clearDraft();
    navigate("/");
  }

  async function finishWorkout() {
    if (!draft) return;
    const exercises: SessionInput["exercises"] = [];
    let skipped = 0;
    for (const exercise of draft.exercises) {
      const sets = [];
      for (const set of exercise.sets) {
        const reps = Number(set.reps);
        const weight = set.weight.trim() === "" ? 0 : Number(set.weight);
        if (!set.done) {
          skipped++;
          continue;
        }
        if (set.reps.trim() === "" || !Number.isInteger(reps) || reps < 0 || !Number.isFinite(weight) || weight < 0) {
          return setError(`Check the weight and reps for ${exercise.name}.`);
        }
        sets.push({ reps, weight });
      }
      if (sets.length) exercises.push({ name: exercise.name, sets });
    }
    if (exercises.length === 0) return setError("Tick ✓ on at least one completed set before finishing.");
    if (skipped && !confirm(`${skipped} set${skipped === 1 ? " isn't" : "s aren't"} marked done and won't be saved. Finish anyway?`)) return;

    setError(undefined);
    setSaving(true);
    try {
      await api.createSession({
        workoutId: draft.workoutId,
        name: draft.name,
        startedAt: draft.startedAt,
        completedAt: new Date().toISOString(),
        exercises,
      });
      clearDraft();
      navigate("/history");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  }

  if (loadError) return <ErrorMessage message={loadError} />;

  if (otherDraft && workout) {
    return (
      <div className="stack-lg">
        <h1>Workout in progress</h1>
        <p>
          You already have <strong>{otherDraft.name}</strong> in progress. Finish it, or discard it to start{" "}
          <strong>{workout.name}</strong>.
        </p>
        <div className="button-row">
          <Link to={`/workouts/${otherDraft.workoutId}/start`} className="btn btn-primary">
            Resume {otherDraft.name}
          </Link>
          <button
            className="btn btn-danger"
            onClick={() => {
              clearDraft();
              setOtherDraft(null);
              setDraft(draftFromWorkout(workout));
            }}
          >
            Discard it and start {workout.name}
          </button>
        </div>
      </div>
    );
  }

  if (!draft) return <Loading />;

  return (
    <div className="stack-lg">
      <div className="page-header">
        <div>
          <h1>{draft.name}</h1>
          <p className="muted small">In progress · {elapsed}</p>
        </div>
      </div>

      {draft.exercises.map((exercise) => (
        <section className="card stack" key={exercise.key}>
          <div className="page-header">
            <div>
              <h3>{exercise.name}</h3>
              <p className="muted small">
                {exercise.targetSets && `Target ${exercise.targetSets} × ${exercise.targetReps}`}
                {exercise.targetSets && exercise.lastSummary && " · "}
                {exercise.lastSummary && `Last ${exercise.lastSummary}`}
              </p>
            </div>
            <button
              className="icon-btn danger"
              aria-label={`Remove ${exercise.name}`}
              onClick={() =>
                confirm(`Remove ${exercise.name} from this workout?`) &&
                setDraft((d) => d && { ...d, exercises: d.exercises.filter((e) => e.key !== exercise.key) })
              }
            >
              ✕
            </button>
          </div>

          <div className="set-row set-row-head">
            <span>Set</span>
            <span>Weight (lb)</span>
            <span>Reps</span>
            <span>Done</span>
            <span />
          </div>
          {exercise.sets.map((set, i) => (
            <div className={`set-row${set.done ? " done" : ""}`} key={i}>
              <span className="set-number">{i + 1}</span>
              <input
                aria-label={`Set ${i + 1} weight`}
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={set.weight}
                placeholder="0"
                onChange={(e) => updateSet(exercise.key, i, { weight: e.target.value })}
              />
              <input
                aria-label={`Set ${i + 1} reps`}
                type="number"
                inputMode="numeric"
                min={0}
                value={set.reps}
                onChange={(e) => updateSet(exercise.key, i, { reps: e.target.value })}
              />
              <button
                className={`check-btn${set.done ? " checked" : ""}`}
                aria-label={`Mark set ${i + 1} done`}
                aria-pressed={set.done}
                onClick={() => updateSet(exercise.key, i, { done: !set.done })}
              >
                ✓
              </button>
              <button
                className="icon-btn"
                aria-label={`Remove set ${i + 1}`}
                disabled={exercise.sets.length === 1}
                onClick={() => updateExercise(exercise.key, (e) => ({ ...e, sets: e.sets.filter((_, j) => j !== i) }))}
              >
                ✕
              </button>
            </div>
          ))}
          <button
            className="btn btn-ghost btn-small"
            onClick={() =>
              updateExercise(exercise.key, (e) => {
                const last = e.sets.at(-1);
                return { ...e, sets: [...e.sets, { weight: last?.weight ?? "", reps: last?.reps ?? "", done: false }] };
              })
            }
          >
            + Add set
          </button>
        </section>
      ))}

      <form
        className="card add-exercise"
        onSubmit={(e) => {
          e.preventDefault();
          addExercise();
        }}
      >
        <input value={newExercise} onChange={(e) => setNewExercise(e.target.value)} placeholder="Add another exercise" maxLength={100} />
        <button type="submit" className="btn" disabled={!newExercise.trim()}>
          Add
        </button>
      </form>

      {error && <ErrorMessage message={error} />}

      <div className="button-row">
        <button className="btn btn-primary" onClick={finishWorkout} disabled={saving}>
          {saving ? "Saving…" : "Finish workout"}
        </button>
        <button className="btn btn-danger push-right" onClick={cancelWorkout} disabled={saving}>
          Discard
        </button>
      </div>
    </div>
  );
}
