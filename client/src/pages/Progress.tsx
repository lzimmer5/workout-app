import { useNavigate, useParams } from "react-router-dom";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../api";
import { ErrorMessage, Loading } from "../components/Status";
import { formatDate, formatSet, formatShortDate, formatWeight } from "../format";
import { useApi } from "../hooks";

const COLORS = { estimated: "#4f9cf9", best: "#f5a524", grid: "#2a3038", axis: "#8b95a1" };

export default function Progress() {
  const params = useParams();
  const exerciseId = params.exerciseId ? Number(params.exerciseId) : null;
  const navigate = useNavigate();
  const exercises = useApi(() => api.listExercises());
  const progress = useApi(() => (exerciseId ? api.getExerciseProgress(exerciseId) : Promise.resolve(null)), [exerciseId]);

  const logged = exercises.data?.filter((e) => e.sessionCount > 0) ?? [];
  const sessions = progress.data?.sessions ?? [];
  const first = sessions[0];
  const latest = sessions.at(-1);
  const bestOneRepMax = sessions.reduce((max, s) => Math.max(max, s.estimatedOneRepMax), 0);
  const chartData = sessions.map((s) => ({
    date: formatShortDate(s.date),
    "Estimated 1RM": s.estimatedOneRepMax,
    "Heaviest set": s.bestWeight,
  }));

  return (
    <div className="stack-lg">
      <h1>Exercise Progress</h1>

      <label className="field">
        <span>Exercise</span>
        <select value={exerciseId ?? ""} onChange={(e) => navigate(e.target.value ? `/progress/${e.target.value}` : "/progress")}>
          <option value="">Select an exercise…</option>
          {logged.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name} ({e.sessionCount} workout{e.sessionCount === 1 ? "" : "s"})
            </option>
          ))}
        </select>
      </label>

      {exercises.error && <ErrorMessage message={exercises.error} onRetry={exercises.reload} />}
      {exercises.data && logged.length === 0 && <p className="muted">Log a workout to start tracking progress.</p>}
      {exerciseId && progress.loading && <Loading />}
      {progress.error && <ErrorMessage message={progress.error} />}

      {progress.data && sessions.length === 0 && <p className="muted">No sets logged for {progress.data.exercise.name} yet.</p>}

      {progress.data && first && latest && (
        <>
          <div className="stats">
            <div className="stat">
              <span className="stat-value">{formatWeight(bestOneRepMax)}</span>
              <span className="stat-label">Best estimated 1RM</span>
            </div>
            <div className="stat">
              <span className="stat-value">
                {formatWeight(latest.bestWeight)} × {latest.repsAtBestWeight}
              </span>
              <span className="stat-label">Latest heaviest set</span>
            </div>
            <div className="stat">
              <span className="stat-value">
                {latest.estimatedOneRepMax - first.estimatedOneRepMax >= 0 ? "+" : ""}
                {formatWeight(Math.round((latest.estimatedOneRepMax - first.estimatedOneRepMax) * 10) / 10)}
              </span>
              <span className="stat-label">Change since first workout</span>
            </div>
          </div>

          {sessions.length > 1 ? (
            <div className="card chart">
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
                  <CartesianGrid stroke={COLORS.grid} vertical={false} />
                  <XAxis dataKey="date" stroke={COLORS.axis} tick={{ fontSize: 12 }} />
                  <YAxis stroke={COLORS.axis} tick={{ fontSize: 12 }} domain={["auto", "auto"]} unit=" lb" width={64} />
                  <Tooltip
                    contentStyle={{ background: "#1a1f26", border: "1px solid #2a3038", borderRadius: 8 }}
                    formatter={(value) => `${value} lb`}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="Estimated 1RM" stroke={COLORS.estimated} strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="Heaviest set" stroke={COLORS.best} strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="muted small">Log this exercise again to see a progress chart.</p>
          )}
          <p className="muted small">Estimated 1RM uses the Epley formula: weight × (1 + reps ÷ 30).</p>

          <div className="card table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Sets</th>
                  <th className="num">Volume</th>
                  <th className="num">Est. 1RM</th>
                </tr>
              </thead>
              <tbody>
                {[...sessions].reverse().map((s) => (
                  <tr key={s.sessionId}>
                    <td>
                      {formatDate(s.date)}
                      <div className="muted small">{s.sessionName}</div>
                    </td>
                    <td className="muted">{s.sets.map(formatSet).join(", ")}</td>
                    <td className="num">{formatWeight(s.volume)}</td>
                    <td className="num">{formatWeight(s.estimatedOneRepMax)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
