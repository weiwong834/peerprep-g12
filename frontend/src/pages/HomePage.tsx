import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getPastSessions, type Session } from "../services/collaborationService";
import { getQuestionById, type Question } from "../services/questionService";

type AttemptEntry = {
  session: Session;
  question: Question | null;
};

function getDuration(start: string, end: string): string {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${mins}min ${secs}s`;
}

function getDifficultyColor(difficulty: string) {
  switch (difficulty.toLowerCase()) {
    case "easy": return "text-green-700 bg-green-50 border border-green-200";
    case "medium": return "text-yellow-700 bg-yellow-50 border border-yellow-200";
    case "hard": return "text-red-700 bg-red-50 border border-red-200";
    default: return "text-slate-600 bg-slate-50 border border-slate-200";
  }
}

export default function HomePage() {
  const [attempts, setAttempts] = useState<AttemptEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    async function loadHistory() {
      try {
        const sessions = await getPastSessions();

        // Fetch question details for each session in parallel
        const entries = await Promise.all(
          sessions.map(async (session) => {
            try {
              const question = await getQuestionById(session.question_id);
              return { session, question };
            } catch {
              return { session, question: null };
            }
          })
        );

        setAttempts(entries);
      } catch (err) {
        setError("Failed to load attempt history.");
      } finally {
        setLoading(false);
      }
    }

    void loadHistory();
  }, []);

  return (
    <div className="flex gap-6">
      {/* Welcome  */}
      <div className="flex-1">
        <h1 className="text-3xl font-bold mb-4">Welcome to PeerPrep</h1>
        <p className="text-slate-600 mb-6">
          Practice coding interviews with peers in real-time.
        </p>
        <div className="bg-white p-6 rounded-xl shadow-sm">
          <h2 className="text-lg font-semibold mb-2">Get Started</h2>
          <div className="space-y-3 text-slate-600 text-sm">
            <p>
              PeerPrep is a collaborative coding interview practice platform
              where users can match with peers and solve technical interview
              questions togSether. We hope to be part of your interview
              preparation, making it more interactive, realistic and accessible.
            </p>

            <p>
              Head to the <strong>Collab</strong> tab to find a match and start
              a session.
            </p>
          </div>
        </div>
      </div>

      {/* Attempt history on right side */}
      <div className="w-96 h-[calc(100vh-8rem)] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Recent Activity</h2>

        {loading && (
          <div className="bg-white p-4 sounded-xl shadow-sm">
            <p className="text-slate-500 text-sm">Loading history...</p>
          </div>
        )}

        {error && (
          <div className="bg-white p4 rounded-xl shadow-sm">
            <p className="text-red-500 text-sm">{error}</p>
          </div>
        )}

        {!loading && !error && attempts.length === 0 && (
          <div className="bg-white p-4 rounded-xl shadow-sm">
            <p className="text-slate-500 text-sm">
              No past sessions yet. Start a session to see your history here.
            </p>
          </div>
        )}

        {!loading && !error && attempts.length > 0 && (
          <div className="space-y-3">
            {attempts.map(({ session, question }) => (
              <div
                key={session.session_id}
                onClick={() => navigate(`/attempt/${session.session_id}`)}
                className="bg-white p-4 rounded-xl shadow-sm"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="font-medium text-sm text-slate-800 leading-snug">
                    {question?.title ?? "Question unavailable"}
                  </p>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${getDifficultyColor(session.difficulty)}`}
                  >
                    {session.difficulty}
                  </span>
                </div>

                <p className="text-xs text-slate-500 mb-1">
                  Topic:{" "}
                  <span className="font-medium text-slate-700">
                    {session.topic}
                  </span>
                </p>
                <p className="text-xs text-slate-500 mb-1">
                  Language:{" "}
                  <span className="font-medium text-slate-700">
                    {session.language}
                  </span>
                </p>
                <p className="text-xs text-slate-500 mb-1">
                  Duration:{" "}
                  <span className="font-medium text-slate-700">
                    {session.end_timestamp
                      ? getDuration(
                          session.start_timestamp,
                          session.end_timestamp,
                        )
                      : "—"}
                  </span>
                </p>
                <p className="text-xs text-slate-400 mt-2">
                  {new Date(session.start_timestamp).toLocaleDateString(
                    "en-SG",
                    {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    },
                  )}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}