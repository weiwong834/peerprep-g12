import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { ChatBubbleLeftRightIcon } from "@heroicons/react/24/outline";
import { getSession, type Session } from "../services/collaborationService";
import { getQuestionById, type Question } from "../services/questionService";
import { getChatHistory, type ChatMessage } from "../services/chatService";
import { getUserInfo } from "../services/userService";
import Editor from "@monaco-editor/react";
import QuestionDisplay from "../components/QuestionDisplay";

function getDifficultyColor(difficulty: string) {
  switch (difficulty.toLowerCase()) {
    case "easy": return "text-green-700 bg-green-50 border border-green-200";
    case "medium": return "text-yellow-700 bg-yellow-50 border border-yellow-200";
    case "hard": return "text-red-700 bg-red-50 border border-red-200";
    default: return "text-slate-600 bg-slate-50 border border-slate-200";
  }
}

function getDuration(start: string, end: string | null): string {
  if (!end) return "—";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${mins}m ${secs}s`;
}

function getEditorLanguage(language: string) {
  switch (language.toLowerCase()) {
    case "javascript": return "javascript";
    case "python": return "python";
    case "java": return "java";
    default: return "plaintext";
  }
}

export default function AttemptHistoryPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [session, setSession] = useState<Session | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isChatOpen, setIsChatOpen] = useState(false);

  useEffect(() => {
    async function load() {
      if (!sessionId) return;
      try {
        const [sessionData, user] = await Promise.all([
          getSession(sessionId),
          getUserInfo(),
        ]);
        setSession(sessionData);
        setUserId(user.id);

        const [questionData, chatData] = await Promise.all([
          getQuestionById(sessionData.question_id),
          getChatHistory(sessionId),
        ]);
        setQuestion(questionData);
        setMessages(chatData.messages);
      } catch (err) {
        setError("Failed to load attempt history.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [sessionId]);

  if (loading) {
    return (
      <div className="max-w-xl">
        <div className="bg-white p-6 rounded-xl shadow-sm">
          <p className="text-slate-600">Loading attempt...</p>
        </div>
      </div>
    );
  }

  if (error || !session || !question) {
    return (
      <div className="max-w-xl">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-red-200">
          <p className="text-red-600">{error || "Session not found."}</p>
          <button
            onClick={() => navigate("/home")}
            className="mt-4 bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`grid gap-3 h-[calc(100dvh-4rem)] min-h-0 ${
        isChatOpen ? "grid-cols-3" : "grid-cols-2"
      }`}
    >
      {/* Left: Question */}
      <div className="bg-white rounded-xl shadow-sm p-6 overflow-auto">
        <div className="flex items-start justify-between gap-2 mb-4">
          {/* <h2 className="text-lg font-semibold">{question.title}</h2> */}
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${getDifficultyColor(session.difficulty)}`}
          >
            {session.difficulty.charAt(0).toUpperCase() +
              session.difficulty.slice(1)}
          </span>
        </div>

        <div className="space-y-1 text-sm text-slate-600 mb-4">
          <p>
            Topic: <strong>{session.topic}</strong>
          </p>
          <p>
            Language: <strong>{session.language}</strong>
          </p>
          <p>
            Duration:{" "}
            <strong>
              {getDuration(session.start_timestamp, session.end_timestamp)}
            </strong>
          </p>
          <p>
            Date:{" "}
            <strong>
              {new Date(session.start_timestamp).toLocaleDateString("en-SG", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </strong>
          </p>
        </div>

        <QuestionDisplay question={question} />
      </div>

      {/* Middle: Code */}
      <div className="bg-white rounded-xl shadow-sm p-6 flex flex-col min-h-0">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Final Code</h2>
          <button
            onClick={() => setIsChatOpen((prev) => !prev)}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${
              isChatOpen
                ? "bg-indigo-100 border-indigo-300 text-indigo-700"
                : "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200"
            }`}
            aria-label={isChatOpen ? "Hide chat history" : "Show chat history"}
            title={isChatOpen ? "Hide chat history" : "Show chat history"}
          >
            <ChatBubbleLeftRightIcon className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="flex-1 border rounded-lg overflow-hidden">
          <Editor
            height="100%"
            language={getEditorLanguage(session.language)}
            value={session.code_content || "// No code submitted"}
            theme="vs-light"
            options={{
              readOnly: true,
              minimap: { enabled: false },
              fontSize: 14,
              automaticLayout: true,
              scrollBeyondLastLine: false,
              wordWrap: "on",
              lineNumbers: "on",
              tabSize: 2,
              padding: { top: 12 },
            }}
          />
        </div>
        <button
          onClick={() => navigate("/home")}
          className="mt-4 bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 w-full"
        >
          Back to Home
        </button>
      </div>

      {/* Right: Chat history */}
      {/* Right: Chat history */}
      {isChatOpen && (
        <div className="bg-white rounded-xl shadow-sm p-6 flex flex-col min-h-0">
          <h2 className="text-lg font-semibold mb-3">Chat History</h2>
          <div className="flex-1 overflow-auto space-y-3">
            {messages.length === 0 ? (
              <p className="text-sm text-slate-500">
                No messages in this session.
              </p>
            ) : (
              messages.map((msg, index) => {
                const isMe = msg.sender_id === userId;
                return (
                  <div
                    key={index}
                    className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                        isMe
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-100 text-slate-800"
                      }`}
                    >
                      {msg.content}
                    </div>
                    <span className="text-xs text-slate-400 mt-1">
                      {new Date(msg.timestamp).toLocaleTimeString("en-SG", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}