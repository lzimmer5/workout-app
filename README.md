# Workout Tracker

A full-stack web app for planning gym workouts, logging sets/reps/weight, and tracking progress over time.

## Tech stack

| Layer    | Choice                                                         |
| -------- | -------------------------------------------------------------- |
| Frontend | React 19 + TypeScript, Vite, React Router, Recharts            |
| Backend  | Node.js + Express 5 + TypeScript, zod for request validation   |
| Database | SQLite via `@libsql/client` — a local file in development, [Turso](https://turso.tech) (hosted SQLite, free tier) in production |

The same database code works against a local file and Turso, so local development needs no database setup.

## Features

- **Dashboard** – workouts this week, saved routines, recent workouts, Start/Create buttons, and a "resume" banner for a workout in progress
- **Create / Edit Workout** – name, exercises, sets and target reps; reorder or remove exercises; delete a routine
- **Active Workout** – log weight and reps per set, prefilled with what you lifted last time; add/remove sets and exercises; the in-progress workout is kept in the browser so a refresh doesn't lose it
- **History** – completed workouts grouped by date
- **Progress** – per-exercise chart of estimated one-rep max and heaviest set, plus a table of every session

Deleting a routine keeps its logged workouts in history.

## Running locally

Requires Node.js 20+.

```bash
npm install
npm run dev
```

Open http://localhost:5173. The API runs on http://localhost:3001 and Vite proxies `/api` to it. A SQLite file is created at `server/local.db` on first run (git-ignored).

Optional: copy `server/.env.example` to `server/.env` to change settings.

## Project structure

```
client/              React app (Vite)
  src/pages/         Dashboard, CreateWorkout, EditWorkout, StartWorkout, ActiveWorkout, History, Progress
  src/components/    WorkoutForm, loading/error states
  src/api.ts         Typed API client
server/              Express API
  src/db.ts          Database connection and schema
  src/routes/        /api/workouts, /api/sessions, /api/exercises
```

## API

| Method | Path                          | Purpose                                     |
| ------ | ----------------------------- | ------------------------------------------- |
| GET    | `/api/workouts`               | List saved routines                         |
| GET    | `/api/workouts/:id`           | Routine with last-logged sets per exercise  |
| POST   | `/api/workouts`               | Create a routine                            |
| PUT    | `/api/workouts/:id`           | Update a routine                            |
| DELETE | `/api/workouts/:id`           | Delete a routine (history is kept)          |
| GET    | `/api/sessions?limit=`        | Logged workouts, newest first               |
| GET    | `/api/sessions/count?since=`  | Number of workouts since a date             |
| POST   | `/api/sessions`               | Save a completed workout                    |
| DELETE | `/api/sessions/:id`           | Delete a logged workout                     |
| GET    | `/api/exercises`              | All exercise names                          |
| GET    | `/api/exercises/:id/progress` | Per-session stats for one exercise          |

## Deploying (free)

In production, the Express server also serves the built React app, so the whole app deploys as one web service.

1. Create a free database on [Turso](https://turso.tech) and get its URL (`libsql://...`) and an auth token.
2. Create a free **Web Service** on [Render](https://render.com) from this GitHub repo:
   - Build command: `npm install && npm run build`
   - Start command: `npm start`
   - Environment variables: `DATABASE_URL`, `DATABASE_AUTH_TOKEN`
3. Tables are created automatically on first start.

Don't use a local SQLite file in production on a free host: their disks are wiped on every redeploy/restart.
