import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { ErrorMessage, Loading } from "../components/Status";
import WorkoutForm from "../components/WorkoutForm";
import { useApi } from "../hooks";

export default function EditWorkout() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const workout = useApi(() => api.getWorkout(id), [id]);
  const [deleteError, setDeleteError] = useState<string>();

  async function handleDelete() {
    if (!workout.data) return;
    if (!confirm(`Delete "${workout.data.name}"? Your logged history for it will be kept.`)) return;
    try {
      await api.deleteWorkout(id);
      navigate("/");
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : String(err));
    }
  }

  if (workout.loading) return <Loading />;
  if (workout.error || !workout.data) return <ErrorMessage message={workout.error ?? "Workout not found"} />;

  return (
    <div className="stack-lg">
      <h1>Edit Workout</h1>
      {deleteError && <ErrorMessage message={deleteError} />}
      <WorkoutForm
        initial={workout.data}
        submitLabel="Save changes"
        onSubmit={async (input) => {
          await api.updateWorkout(id, input);
          navigate("/");
        }}
        actions={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>
              Cancel
            </button>
            <button type="button" className="btn btn-danger push-right" onClick={handleDelete}>
              Delete workout
            </button>
          </>
        }
      />
    </div>
  );
}
