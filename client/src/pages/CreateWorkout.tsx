import { useNavigate } from "react-router-dom";
import { api } from "../api";
import WorkoutForm from "../components/WorkoutForm";

export default function CreateWorkout() {
  const navigate = useNavigate();
  return (
    <div className="stack-lg">
      <h1>Create Workout</h1>
      <WorkoutForm
        submitLabel="Save workout"
        onSubmit={async (input) => {
          await api.createWorkout(input);
          navigate("/");
        }}
        actions={
          <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>
            Cancel
          </button>
        }
      />
    </div>
  );
}
