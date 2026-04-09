import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { getUserInfo } from "../services/userService";
import CollaborationRoom from "../components/CollaborationRoom";
import { getSession, getActiveSession, type Session } from "../services/collaborationService";
import { getQuestionById, type Question } from "../services/questionService";

type CollabState =
  | "idle"
  | "connecting"
  | "waiting"
  | "confirming"
  | "active"
  | "error"
  | "banned";

type MatchResponseStatus =
  | "queued"
  | "perfect_match_found"
  | "imperfect_match_needs_confirmation"
  | "match_success"
  | "match_timeout"
  | "cancelled"
  | "unsuccessful_match";

type MatchCriteria = {
  topic: string;
  difficulty: string;
  language: string;
};

type CandidateMatch = {
  userAId: string;
  userBId: string;
  isPerfect: boolean;
  criteriaA: MatchCriteria;
  criteriaB: MatchCriteria;
  queuedAtUserA?: number;
  queuedAtUserB?: number;
  resolvedCriteria?: MatchCriteria;
};

type MatchResponsePayload = {
  status: MatchResponseStatus;
  flowStatus: string;
  sessionId?: string;
  timeoutSeconds?: number;
  message?: string;
  proposedMatch?: CandidateMatch;
};

const MATCHING_SERVER_URL =
  import.meta.env.VITE_MATCHING_SERVICE_URL || "http://localhost:3002";

export default function CollabPage() {
  const socketRef = useRef<Socket | null>(null);
  const suppressNextDisconnectMessageRef = useRef(false);

  const [state, setState] = useState<CollabState>("connecting");
  const [isConnected, setIsConnected] = useState(false);

  const [userId, setUserId] = useState("");
  const [username, setUsername] = useState("");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [language, setLanguage] = useState("javascript");

  const [message, setMessage] = useState("");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [sessionId, setSessionId] = useState("");
  const [proposedMatch, setProposedMatch] = useState<CandidateMatch | null>(
    null,
  );
  const [session, setSession] = useState<Session | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [isRoomLoading, setIsRoomLoading] = useState(false);

  const [confirmationChoice, setConfirmationChoice] = useState<
    "accepted" | "declined" | null
  >(null);
  // Avoid manual socket disconnect triggering notif to user
  function disconnectMatchingSocket(suppressDisconnectMessage = false) {
    if (!socketRef.current) return;
    if (suppressDisconnectMessage) {
      suppressNextDisconnectMessageRef.current = true;
    }

    socketRef.current.disconnect();
    socketRef.current = null;
    setIsConnected(false);
  }

  function connectMatchingSocket(mountedRef?: { current: boolean }) {
    if (socketRef.current?.connected) return;

    const token = localStorage.getItem("accessToken");
    if (!token) {
      if (mountedRef && !mountedRef.current) return;
      setIsConnected(false);
      setState("error");
      setMessage("Missing authentication token. Please log in again.");
      return;
    }

    const socket = io(MATCHING_SERVER_URL, {
      transports: ["websocket"],
      auth: {
        token,
      },
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      if (mountedRef && !mountedRef.current) return;
      setIsConnected(true);
      setState("idle");
      setMessage("");
      console.log("Connected to matching service:", socket.id);
    });

    socket.on("disconnect", (reason) => {
      if (mountedRef && !mountedRef.current) return;
      setIsConnected(false);
      console.log("Disconnected from matching service:", reason);

      if (suppressNextDisconnectMessageRef.current) {
        suppressNextDisconnectMessageRef.current = false;
        return;
      }

      setMessage("Disconnected from matching service.");
    });

    socket.on("connect_error", (error) => {
      if (mountedRef && !mountedRef.current) return;
      console.error("Socket connection error:", error);
      setIsConnected(false);
      setState("error");
      setMessage(error.message || "Failed to connect to matching service.");
    });

    socket.on("match_response", (payload: MatchResponsePayload) => {
      if (mountedRef && !mountedRef.current) return;

      console.log("MATCH_RESPONSE:", payload);

      setMessage(payload.message || "");
      setCountdown(
        typeof payload.timeoutSeconds === "number"
          ? payload.timeoutSeconds
          : null,
      );

      switch (payload.status) {
        case "queued":
          setState("waiting");
          setProposedMatch(null);
          setSessionId("");
          break;

        case "imperfect_match_needs_confirmation":
          setState("confirming");
          setProposedMatch(payload.proposedMatch || null);
          setConfirmationChoice(null);
          break;

        case "perfect_match_found":
          setProposedMatch(null);
          setConfirmationChoice(null);
          if (payload.sessionId) {
            void loadSessionRoom(payload.sessionId);
          } else {
            setState("error");
            setMessage("Match found but no session ID was returned.");
          }
          break;

        case "match_success":
          setProposedMatch(null);
          setConfirmationChoice(null);
          if (payload.sessionId) {
            void loadSessionRoom(payload.sessionId);
          } else {
            setState("error");
            setMessage("Match succeeded but no session ID was returned.");
          }
          break;

        case "match_timeout":
          setState("error");
          setProposedMatch(null);
          setSessionId("");
          break;

        case "unsuccessful_match":
          setProposedMatch(null);
          setSessionId("");

          if (
            (payload.message || "").toLowerCase().includes("temporarily banned")
          ) {
            setState("banned");
          } else {
            setState("error");
          }
          break;

        case "cancelled":
          resetMatchState("idle");
          setMessage(payload.message || "Matching cancelled.");
          break;

        default:
          break;
      }
    });

    socket.on("cancel_response", (payload: MatchResponsePayload) => {
      if (mountedRef && !mountedRef.current) return;

      console.log("CANCEL_RESPONSE:", payload);
      setMessage(payload.message || "");

      switch (payload.status) {
        case "cancelled":
          resetMatchState("idle");
          setMessage(payload.message || "Matching cancelled.");
          break;

        case "imperfect_match_needs_confirmation":
          setState("confirming");
          break;

        case "unsuccessful_match":
          setState((prev) => prev);
          break;

        default:
          break;
      }
    });
  }

  useEffect(() => {
    const mountedRef = { current: true };

    async function setupUserAndSocket() {
      try {
        const user = await getUserInfo();
        if (!mountedRef.current) return;
        setUserId(user.id);
        setUsername(user.username);
        try {
          const activeSession = await getActiveSession();
          if (!mountedRef.current) return;

          console.log("ACTIVE SESSION:", activeSession);

          if (activeSession?.session_id) {
            await loadSessionRoom(activeSession.session_id);
            return;
          }
        } catch {
        }
      } catch (error) {
        console.error("Failed to load user info:", error);
        if (!mountedRef.current) return;
        setState("error");
        setMessage("Failed to load user info.");
        return;
      }

      connectMatchingSocket(mountedRef);
    }

    void setupUserAndSocket();

    return () => {
      mountedRef.current = false;
      disconnectMatchingSocket(true);
    };
  }, []);

  useEffect(() => {
    if (countdown === null || countdown <= 0) return;

    const timer = setTimeout(() => {
      setCountdown((prev) => (prev === null ? null : prev - 1));
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown]);

  function handleFindMatch() {
    if (!socketRef.current || !isConnected) {
      setState("error");
      setMessage("Not connected to matching service.");
      return;
    }

    if (!userId || !topic || !difficulty || !language) {
      return;
    }

    socketRef.current.emit("match_request", {
      userId,
      criteria: {
        topic,
        difficulty,
        language,
      },
    });
  }

  function handleCancelQueue() {
    if (!socketRef.current || !isConnected || !userId) return;

    socketRef.current.emit("cancel_request", { userId });
  }

  function handleConfirmMatch(accepted: boolean) {
    if (!socketRef.current || !isConnected || !userId) return;

    setConfirmationChoice(accepted ? "accepted" : "declined");

    if (accepted) {
      setMessage("You accepted the match. Waiting for the other user...");
    }

    socketRef.current.emit("confirm_request", {
      userId,
      accepted,
    });
  }

  function resetMatchState(nextState: CollabState = "idle") {
    setState(nextState);
    setCountdown(null);
    setProposedMatch(null);
    setSessionId("");
    setConfirmationChoice(null);
  }

  function handleLeaveSession() {
    setState("idle");
    setSessionId("");
    setSession(null);
    setQuestion(null);
    setProposedMatch(null);
    setMessage("");
    setCountdown(null);
    setConfirmationChoice(null);

    if (!socketRef.current || !socketRef.current.connected) {
      connectMatchingSocket();
    } else {
      setIsConnected(true);
    }
  }

  async function loadSessionRoom(targetSessionId: string) {
    try {
      setIsRoomLoading(true);
      setMessage("Loading collaboration room...");
      console.log("Loading session room for:", targetSessionId);
      const sessionData = await getSession(targetSessionId);
      console.log("SESSION DATA:", sessionData);
      const questionData = await getQuestionById(sessionData.question_id);
      console.log("QUESTION DATA:", questionData);

      // Once collaboration room opens, stop listening to matching events
      disconnectMatchingSocket(true);

      setSession(sessionData);
      setQuestion(questionData);
      setSessionId(targetSessionId);
      setState("active");
      setMessage("");
      console.log("Loading session room for:", targetSessionId);
    } catch (error) {
      console.error("Failed to load collaboration room:", error);
      setState("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Failed to load collaboration session.",
      );
    } finally {
      setIsRoomLoading(false);
    }
  }

  if (state === "connecting") {
    return (
      <div className="max-w-xl">
        <h1 className="text-2xl font-bold mb-6">Start Collaboration</h1>
        <div className="bg-white p-6 rounded-xl shadow-sm">
          <p className="text-slate-600">Connecting to matching service...</p>
        </div>
      </div>
    );
  }

  if (state === "idle") {
    return (
      <div className="max-w-xl">
        <h1 className="text-2xl font-bold mb-6">Start Collaboration</h1>

        <div className="bg-white p-6 rounded-xl shadow-sm space-y-4">
          {!isConnected && (
            <p className="text-sm text-red-500">
              Not connected to matching service.
            </p>
          )}

          {message && <p className="text-sm text-slate-600">{message}</p>}

          <div>
            <label className="block text-sm font-medium mb-1">Topic</label>
            <select
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
            >
              <option value="">Select topic</option>
              <option value="Arrays">Arrays</option>
              <option value="Strings">Strings</option>
              <option value="Graphs">Graphs</option>
              <option value="Trees">Trees</option>
              <option value="Sorting">Sorting</option>
              <option value="Hash Tables">Hash Tables</option>
              <option value="Linked List">Linked List</option>
              <option value="Recursion">Recursion</option>
              <option value="Heaps">Heaps</option>
              <option value="Tries">Tries</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Difficulty</label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
            >
              <option value="">Select difficulty</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Language</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
            >
              <option value="javascript">JavaScript</option>
              <option value="python">Python</option>
              <option value="java">Java</option>
            </select>
          </div>

          <button
            onClick={handleFindMatch}
            disabled={!topic || !difficulty || !language || !isConnected}
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
          >
            Find Match
          </button>
        </div>
      </div>
    );
  }

  if (state === "waiting") {
    return (
      <div className="max-w-xl">
        <h1 className="text-2xl font-bold mb-6">Finding a Peer...</h1>

        <div className="bg-white p-6 rounded-xl shadow-sm text-center space-y-4">
          <p className="text-slate-600">
            {message || "Matching you with another user."}
          </p>

          <p className="text-sm text-slate-500">
            Topic: <strong>{topic}</strong>
          </p>

          <p className="text-sm text-slate-500">
            Difficulty: <strong>{difficulty}</strong>
          </p>

          <p className="text-sm text-slate-500">
            Language: <strong>{language}</strong>
          </p>

          {countdown !== null && (
            <p className="text-sm text-slate-500">
              Timeout in{" "}
              <span className="font-semibold text-red-500">{countdown}s</span>
            </p>
          )}

          <div className="animate-pulse text-blue-600 font-medium">
            Searching...
          </div>

          <button
            onClick={handleCancelQueue}
            className="mt-4 px-4 py-2 border rounded-lg hover:bg-gray-100"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (state === "confirming") {
    return (
      <div className="max-w-xl">
        <h1 className="text-2xl font-bold mb-6">Confirm Match</h1>

        <div className="bg-white p-6 rounded-xl shadow-sm space-y-4 border border-yellow-200">
          <p className="text-slate-700 font-medium">
            {message || "An imperfect match was found."}
          </p>

          {proposedMatch?.resolvedCriteria && (
            <div className="text-sm text-slate-600 space-y-1">
              <p>
                Topic: <strong>{proposedMatch.resolvedCriteria.topic}</strong>
              </p>
              <p>
                Difficulty:{" "}
                <strong>{proposedMatch.resolvedCriteria.difficulty}</strong>
              </p>
              <p>
                Language:{" "}
                <strong>{proposedMatch.resolvedCriteria.language}</strong>
              </p>
            </div>
          )}

          {countdown !== null && (
            <p className="text-sm text-slate-500">
              Expires in{" "}
              <span className="font-semibold text-red-500">{countdown}s</span>
            </p>
          )}

          {confirmationChoice === "accepted" && (
            <p className="text-sm text-green-600 text-center">
              You accepted the match. Waiting for the other user...
            </p>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => handleConfirmMatch(true)}
              className={`w-full py-2 rounded-lg transition ${
                confirmationChoice === "accepted"
                  ? "bg-green-200 text-green-800 ring-2 ring-green-500"
                  : "bg-green-600 text-white hover:bg-green-700"
              }`}
            >
              Accept Match
            </button>

            <button
              onClick={() => handleConfirmMatch(false)}
              className={`w-full py-2 rounded-lg border transition ${
                confirmationChoice === "declined"
                  ? "bg-red-100 text-red-700 border-red-300 ring-2 ring-red-400"
                  : "hover:bg-gray-100"
              }`}
            >
              Decline Match
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (state === "active") {
    if (isRoomLoading || !session || !question) {
      return (
        <div className="max-w-xl">
          <h1 className="text-2xl font-bold mb-6">
            Loading Collaboration Room
          </h1>
          <div className="bg-white p-6 rounded-xl shadow-sm">
            <p className="text-slate-600">
              {message || "Loading session and question..."}
            </p>
          </div>
        </div>
      );
    }

    return (
      <CollaborationRoom
        session={session}
        question={question}
        userId={userId}
        username={username}
        onLeave={handleLeaveSession}
      />
    );
  }

  if (state === "banned") {
    return (
      <div className="max-w-xl">
        <h1 className="text-2xl font-bold mb-6">Matching Unavailable</h1>

        <div className="bg-white p-6 rounded-xl shadow-sm space-y-4 border border-red-200">
          <p className="text-slate-700">
            {message || "You are temporarily banned from matching."}
          </p>

          <button
            onClick={() => {
              setState("idle");
              setCountdown(null);
              setProposedMatch(null);
              setSessionId("");
            }}
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="max-w-xl">
        <h1 className="text-2xl font-bold mb-6">Matching Error</h1>

        <div className="bg-white p-6 rounded-xl shadow-sm space-y-4 border border-red-200">
          <p className="text-slate-700">{message || "Something went wrong."}</p>

          <button
            onClick={() => {
              resetMatchState("idle");
              setMessage("");
            }}
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
          >
            Back to Matching
          </button>
        </div>
      </div>
    );
  }

  return null;
}
