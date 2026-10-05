import { Link } from "react-router-dom";
import { api } from "../api";
import { ErrorMessage, Loading } from "../components/Status";
import { loadDraft } from "../draft";
import { formatDate, formatDuration, formatShortDate, startOfWeek } from "../format";
import { useApi } from "../hooks";

export default function Dashboard() {
  const workouts = useApi(() => api.listWorkouts());
  const recent = useApi(() => api.listSessions(5));
  const weekly = useApi(() => api.countSessionsSince(startOfWeek()));
  const draft = loadDraft();

  return (
    <div className="stack-lg">
      <div className="page-header">
        <h1>Dashboard</h1>
        <div className="button-row">
          <Link to="/start" className="btn btn-primary">
            Start Workout
          </Link>
          <Link to="/workouts/new" className="btn">
            Create Workout
          </Link>
        </div>
      </div>

      {draft && (
        <div className="banner">
          <span>
            <strong>{draft.name}</strong> is in progress (started {formatShortDate(draft.startedAt)}).
          </span>
          <Link to={`/workouts/${draft.workoutId}/start`} className="btn btn-small btn-primary">
            Resume
          </Link>
        </div>
      )}

      <div className="stats">
        <div className="stat">
          <span className="stat-value">{weekly.data?.count ?? "–"}</span>
          <span className="stat-label">Workouts this week</span>
        </div>
        <div className="stat">
          <span className="stat-value">{workouts.data?.length ?? "–"}</span>
          <span className="stat-label">Saved routines</span>
        </div>
      </div>

      <section className="stack">
        <h2>Saved routines</h2>
        {workouts.loading && !workouts.data && <Loading />}
        {workouts.error && <ErrorMessage message={workouts.error} onRetry={workouts.reload} />}
        {workouts.data?.length === 0 && (
          <p className="muted">
            No routines yet. <Link to="/workouts/new">Create your first workout</Link>.
          </p>
        )}
        <div className="grid">
          {workouts.data?.map((w) => (
            <div className="card" key={w.id}>
              <h3>{w.name}</h3>
              <p className="muted small">
                {w.exercises.length} exercise{w.exercises.length === 1 ? "" : "s"} ·{" "}
                {w.lastPerformedAt ? `last done ${formatShortDate(w.lastPerformedAt)}` : "not done yet"}
              </p>
              <ul className="plain small">
                {w.exercises.map((e, i) => (
                  <li key={i}>
                    {e.name} <span className="muted">{e.targetSets} × {e.targetReps}</span>
                  </li>
                ))}
              </ul>
              <div className="button-row">
                <Link to={`/workouts/${w.id}/start`} className="btn btn-small btn-primary">
                  Start
                </Link>
                <Link to={`/workouts/${w.id}/edit`} className="btn btn-small">
                  Edit
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="stack">
        <div className="page-header">
          <h2>Recent workouts</h2>
          <Link to="/history" className="small">
            View all →
          </Link>
        </div>
        {recent.loading && !recent.data && <Loading />}
        {recent.error && <ErrorMessage message={recent.error} onRetry={recent.reload} />}
        {recent.data?.length === 0 && <p className="muted">No workouts logged yet.</p>}
        {recent.data?.map((s) => (
          <div className="card row-card" key={s.id}>
            <div>
              <strong>{s.name}</strong>
              <div className="muted small">
                {formatDate(s.completedAt)} · {formatDuration(s.startedAt, s.completedAt)}
              </div>
            </div>
            <span className="muted small">
              {s.exercises.length} exercise{s.exercises.length === 1 ? "" : "s"}
            </span>
          </div>
        ))}
      </section>
    </div>
  );
}
