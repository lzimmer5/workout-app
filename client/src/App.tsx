import { NavLink, Route, Routes } from "react-router-dom";
import ActiveWorkout from "./pages/ActiveWorkout";
import CreateWorkout from "./pages/CreateWorkout";
import Dashboard from "./pages/Dashboard";
import EditWorkout from "./pages/EditWorkout";
import History from "./pages/History";
import Progress from "./pages/Progress";
import StartWorkout from "./pages/StartWorkout";

export default function App() {
  return (
    <>
      <header className="topbar">
        <NavLink to="/" className="brand">
          Workout Tracker
        </NavLink>
        <nav>
          <NavLink to="/" end>
            Dashboard
          </NavLink>
          <NavLink to="/history">History</NavLink>
          <NavLink to="/progress">Progress</NavLink>
        </nav>
      </header>
      <main className="container">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/start" element={<StartWorkout />} />
          <Route path="/workouts/new" element={<CreateWorkout />} />
          <Route path="/workouts/:id/edit" element={<EditWorkout />} />
          <Route path="/workouts/:id/start" element={<ActiveWorkout />} />
          <Route path="/history" element={<History />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="/progress/:exerciseId" element={<Progress />} />
          <Route path="*" element={<p className="muted">Page not found.</p>} />
        </Routes>
      </main>
    </>
  );
}
