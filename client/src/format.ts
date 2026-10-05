import type { SetEntry } from "./api";

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

export function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function formatDuration(startIso: string, endIso: string) {
  const minutes = Math.max(0, Math.round((Date.parse(endIso) - Date.parse(startIso)) / 60000));
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

export function formatWeight(weight: number) {
  return `${Number.isInteger(weight) ? weight : weight.toFixed(1)} lb`;
}

export function formatSet(set: SetEntry) {
  return set.weight > 0 ? `${set.weight} × ${set.reps}` : `${set.reps} reps`;
}

/** Monday 00:00 of the current week, in the user's local time zone. */
export function startOfWeek(date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}
