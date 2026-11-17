import { useEffect, useState } from 'react';
import { getJson } from '../api/client.js';

type WorkoutSuggestion = { title: string; reason: string };
const suggestionEmail = 'mona@example.com';

export default function Workouts() {
  const [suggestions, setSuggestions] = useState<WorkoutSuggestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getJson<{ suggestions: WorkoutSuggestion[] }>(
      `/api/workouts/suggestions/${encodeURIComponent(suggestionEmail)}`,
    )
      .then(({ suggestions: result }) => {
        if (active) setSuggestions(result);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Unable to load workout suggestions.');
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="card h-100">
      <div className="card-body">
        <h2 className="h4">Workout suggestions</h2>
        <p>Recommend workouts from activity patterns.</p>
        {error ? (
          <p role="alert">Unable to load workout suggestions: {error}</p>
        ) : suggestions === null ? (
          <p role="status">Loading workout suggestions...</p>
        ) : suggestions.length === 0 ? (
          <p>No workout suggestions yet.</p>
        ) : (
          <ul>
            {suggestions.map((suggestion, index) => (
              <li key={`${suggestion.title}-${index}`}>
                <strong>{suggestion.title}</strong>: {suggestion.reason}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
