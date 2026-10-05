import { Link } from "react-router-dom";
import { api } from "../api";
import { ErrorMessage, Loading } from "../components/Status";
import { formatShortDate } from "../format";
import { useApi } from "../hooks";

export default function StartWorkout() {
  const workouts = useApi(() => api.listWorkouts());

  return (
    <div className="stack-lg">
      <h1>Start a Workout</h1>
      <p className="muted">Choose a routine to follow.</p>
      {workouts.loading && <Loading />}
      {workouts.error && <ErrorMessage message={workouts.error} onRetry={workouts.reload} />}
      {workouts.data?.length === 0 && (
        <p className="muted">
          You don't have any routines yet. <Link to="/workouts/new">Create one first</Link>.
        </p>
      )}
      <div className="stack">
        {workouts.data?.map((w) => (
          <Link to={`/workouts/${w.id}/start`} className="card row-card link-card" key={w.id}>
            <div>
              <strong>{w.name}</strong>
              <div className="muted small">{w.exercises.map((e) => e.name).join(", ")}</div>
            </div>
            <span className="muted small">{w.lastPerformedAt ? formatShortDate(w.lastPerformedAt) : "New"}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
