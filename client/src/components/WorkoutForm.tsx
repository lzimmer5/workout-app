import { useState, type FormEvent, type ReactNode } from "react";
import { api, type WorkoutInput } from "../api";
import { newKey } from "../draft";
import { useApi } from "../hooks";
import { ErrorMessage } from "./Status";

interface Row {
  key: string;
  name: string;
  targetSets: string;
  targetReps: string;
}

interface Props {
  initial?: WorkoutInput;
  submitLabel: string;
  onSubmit: (input: WorkoutInput) => Promise<void>;
  /** Extra buttons shown next to the submit button (e.g. Delete on the edit page). */
  actions?: ReactNode;
}

const emptyRow = (): Row => ({ key: newKey(), name: "", targetSets: "3", targetReps: "10" });

export default function WorkoutForm({ initial, submitLabel, onSubmit, actions }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [rows, setRows] = useState<Row[]>(
    initial?.exercises.map((e) => ({
      key: newKey(),
      name: e.name,
      targetSets: String(e.targetSets),
      targetReps: String(e.targetReps),
    })) ?? [emptyRow()],
  );
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const knownExercises = useApi(() => api.listExercises());

  const updateRow = (index: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r, i) => (i === index ? { ...r, ...patch } : r)));

  const moveRow = (index: number, delta: number) =>
    setRows((rs) => {
      const target = index + delta;
      if (target < 0 || target >= rs.length) return rs;
      const next = [...rs];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const filled = rows.filter((r) => r.name.trim());
    if (!name.trim()) return setError("Give your workout a name.");
    if (filled.length === 0) return setError("Add at least one exercise.");
    const input: WorkoutInput = {
      name: name.trim(),
      exercises: filled.map((r) => ({
        name: r.name.trim(),
        targetSets: Number(r.targetSets),
        targetReps: Number(r.targetReps),
      })),
    };
    const invalid = input.exercises.find(
      (ex) => !Number.isInteger(ex.targetSets) || ex.targetSets < 1 || !Number.isInteger(ex.targetReps) || ex.targetReps < 1,
    );
    if (invalid) return setError(`Sets and reps for ${invalid.name} must be whole numbers of at least 1.`);

    setError(undefined);
    setSaving(true);
    try {
      await onSubmit(input);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  }

  return (
    <form className="stack" onSubmit={handleSubmit}>
      <label className="field">
        <span>Workout name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Push Day" maxLength={100} autoFocus />
      </label>

      <div className="card">
        <div className="exercise-row exercise-row-head">
          <span>Exercise</span>
          <span>Sets</span>
          <span>Reps</span>
          <span />
        </div>
        {rows.map((row, i) => (
          <div className="exercise-row" key={row.key}>
            <input
              aria-label="Exercise name"
              list="exercise-names"
              value={row.name}
              onChange={(e) => updateRow(i, { name: e.target.value })}
              placeholder="e.g. Bench Press"
              maxLength={100}
            />
            <input
              aria-label="Number of sets"
              type="number"
              inputMode="numeric"
              min={1}
              max={20}
              value={row.targetSets}
              onChange={(e) => updateRow(i, { targetSets: e.target.value })}
            />
            <input
              aria-label="Target reps"
              type="number"
              inputMode="numeric"
              min={1}
              max={100}
              value={row.targetReps}
              onChange={(e) => updateRow(i, { targetReps: e.target.value })}
            />
            <div className="row-actions">
              <button type="button" className="icon-btn" onClick={() => moveRow(i, -1)} disabled={i === 0} aria-label="Move up">
                ↑
              </button>
              <button
                type="button"
                className="icon-btn"
                onClick={() => moveRow(i, 1)}
                disabled={i === rows.length - 1}
                aria-label="Move down"
              >
                ↓
              </button>
              <button
                type="button"
                className="icon-btn danger"
                onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
                disabled={rows.length === 1}
                aria-label="Remove exercise"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
        <button type="button" className="btn btn-ghost" onClick={() => setRows((rs) => [...rs, emptyRow()])}>
          + Add exercise
        </button>
      </div>

      <datalist id="exercise-names">
        {knownExercises.data?.map((e) => <option key={e.id} value={e.name} />)}
      </datalist>

      {error && <ErrorMessage message={error} />}

      <div className="button-row">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "Saving…" : submitLabel}
        </button>
        {actions}
      </div>
    </form>
  );
}
