import { useState } from "react";
import { Link } from "react-router-dom";
import { api, type Session } from "../api";
import { ErrorMessage, Loading } from "../components/Status";
import { formatDate, formatDuration, formatSet, formatTime } from "../format";
import { useApi } from "../hooks";

function groupByDay(sessions: Session[]) {
  const groups = new Map<string, Session[]>();
  for (const s of sessions) {
    const day = formatDate(s.completedAt);
    groups.set(day, [...(groups.get(day) ?? []), s]);
  }
  return [...groups.entries()];
}

export default function History() {
  const sessions = useApi(() => api.listSessions(500));
  const [error, setError] = useState<string>();

  async function handleDelete(session: Session) {
    if (!confirm(`Delete the ${session.name} workout from ${formatDate(session.completedAt)}? This can't be undone.`)) return;
    try {
      await api.deleteSession(session.id);
      sessions.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="stack-lg">
      <h1>Workout History</h1>
      {sessions.loading && !sessions.data && <Loading />}
      {(sessions.error || error) && <ErrorMessage message={(sessions.error || error)!} onRetry={sessions.reload} />}
      {sessions.data?.length === 0 && (
        <p className="muted">
          No workouts logged yet. <Link to="/start">Start one</Link>.
        </p>
      )}

      {sessions.data &&
        groupByDay(sessions.data).map(([day, daySessions]) => (
          <section className="stack" key={day}>
            <h2 className="day-heading">{day}</h2>
            {daySessions.map((s) => (
              <article className="card stack" key={s.id}>
                <div className="page-header">
                  <div>
                    <h3>{s.name}</h3>
                    <p className="muted small">
                      {formatTime(s.startedAt)} · {formatDuration(s.startedAt, s.completedAt)}
                    </p>
                  </div>
                  <button className="icon-btn danger" aria-label="Delete workout" onClick={() => handleDelete(s)}>
                    ✕
                  </button>
                </div>
                <table className="table">
                  <tbody>
                    {s.exercises.map((e, i) => (
                      <tr key={i}>
                        <td>
                          <Link to={`/progress/${e.exerciseId}`}>{e.name}</Link>
                        </td>
                        <td className="muted">{e.sets.map(formatSet).join(", ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </article>
            ))}
          </section>
        ))}
    </div>
  );
}
