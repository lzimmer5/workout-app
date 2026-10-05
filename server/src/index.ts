import "dotenv/config";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "./db.js";
import { errorHandler } from "./http.js";
import exercisesRouter from "./routes/exercises.js";
import sessionsRouter from "./routes/sessions.js";
import workoutsRouter from "./routes/workouts.js";

const app = express();
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});
app.use("/api/workouts", workoutsRouter);
app.use("/api/sessions", sessionsRouter);
app.use("/api/exercises", exercisesRouter);
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// In production the server also serves the built React app, so it can be hosted as one service.
const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../client/dist");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get("/{*splat}", (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

app.use(errorHandler);

await migrate();
const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
