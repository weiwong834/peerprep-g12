import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { getUserInfo } from "../services/userService";

type CollabState =
  | "idle"
  | "connecting"
  | "waiting"
  | "confirming"
  | "matched"
  | "active"
  | "error";

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

const MATCHING_SERVER_URL = "http://localhost:3002";

export default function CollabPage() {
  const socketRef = useRef<Socket | null>(null);

  const [state, setState] = useState<CollabState>("connecting");
  const [isConnected, setIsConnected] = useState(false);

  const [userId, setUserId] = useState("");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [language, setLanguage] = useState("javascript");

  const [message, setMessage] = useState("");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [sessionId, setSessionId] = useState("");
  const [proposedMatch, setProposedMatch] = useState<CandidateMatch | null>(
    null,
  );

  useEffect(() => {
    let mounted = true;

    async function setupUserAndSocket() {
      try {
        const user = await getUserInfo();
        if (!mounted) return;
        setUserId(user.id);
      } catch (error) {
        console.error("Failed to load user info:", error);
        if (!mounted) return;
        setState("error");
        setMessage("Failed to load user info.");
        return;
      }

      const socket = io(MATCHING_SERVER_URL, {
        transports: ["websocket"],
      });

      socketRef.current = socket;

      socket.on("connect", () => {
        if (!mounted) return;
        setIsConnected(true);
        setState("idle");
        setMessage("");
        console.log("Connected to matching service:", socket.id);
      });

      socket.on("disconnect", (reason) => {
        if (!mounted) return;
        setIsConnected(false);
        console.log("Disconnected from matching service:", reason);
      });

      socket.on("connect_error", (error) => {
        console.error("Socket connection error:", error);
        if (!mounted) return;
        setIsConnected(false);
        setState("error");
        setMessage(error.message || "Failed to connect to matching service.");
      });

      socket.on("match_response", (payload: MatchResponsePayload) => {
        console.log("MATCH_RESPONSE:", payload);

        setMessage(payload.message || "");
        if (typeof payload.timeoutSeconds === "number") {
          setCountdown(payload.timeoutSeconds);
        }

        switch (payload.status) {
          case "queued":
            setState("waiting");
            setProposedMatch(null);
            setSessionId("");
            break;

          case "imperfect_match_needs_confirmation":
            setState("confirming");
            setProposedMatch(payload.proposedMatch || null);
            break;

          case "perfect_match_found":
            // optional intermediate state
            setState("matched");
            if (payload.sessionId) {
              setSessionId(payload.sessionId);
            }
            break;

          case "match_success":
            setState("matched");
            setProposedMatch(null);
            if (payload.sessionId) {
              setSessionId(payload.sessionId);
            }
            break;

          case "match_timeout":
            setState("error");
            setProposedMatch(null);
            setCountdown(null);
            break;

          case "unsuccessful_match":
            setState("error");
            setProposedMatch(null);
            setCountdown(null);
            break;

          case "cancelled":
            setState("idle");
            setProposedMatch(null);
            setCountdown(null);
            setSessionId("");
            setMessage(payload.message || "Matching cancelled.");
            break;

          default:
            break;
        }
      });

      socket.on("cancel_response", (payload: MatchResponsePayload) => {
        console.log("CANCEL_RESPONSE:", payload);
        setState("idle");
        setMessage(payload.message || "Matching cancelled.");
        setProposedMatch(null);
        setCountdown(null);
        setSessionId("");
      });
    }

    void setupUserAndSocket();

    return () => {
      mounted = false;
      socketRef.current?.disconnect();
      socketRef.current = null;
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

    socketRef.current.emit("confirm_request", {
      userId,
      accepted,
    });
  }

  function handleEnterRoom() {
    // later can navigate to /collab/:sessionId if route is changed
    console.log("Entering room with sessionId:", sessionId);
    setState("active");
  }

  function handleLeaveSession() {
    setState("idle");
    setSessionId("");
    setProposedMatch(null);
    setMessage("");
    setCountdown(null);
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

          <button
            onClick={() => handleConfirmMatch(true)}
            className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700"
          >
            Accept Match
          </button>

          <button
            onClick={() => handleConfirmMatch(false)}
            className="w-full border py-2 rounded-lg hover:bg-gray-100"
          >
            Decline Match
          </button>
        </div>
      </div>
    );
  }

  if (state === "matched") {
    return (
      <div className="max-w-xl">
        <h1 className="text-2xl font-bold mb-6">Match Found</h1>

        <div className="bg-white p-6 rounded-xl shadow-sm text-center space-y-4 border border-green-200">
          <h2 className="text-xl font-semibold text-slate-800">
            We found you a match!
          </h2>

          <p className="text-slate-600">
            {message || "Your collaboration session is ready."}
          </p>

          {sessionId && (
            <p className="text-sm text-slate-500 break-all">
              Session ID: <strong>{sessionId}</strong>
            </p>
          )}

          <button
            onClick={handleEnterRoom}
            className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700"
          >
            Enter Room
          </button>
        </div>
      </div>
    );
  }

  if (state === "active") {
    return (
      <div className="grid grid-cols-2 gap-6 h-[80vh]">
        <div className="bg-white rounded-xl shadow-sm p-6 overflow-auto">
          <h2 className="text-lg font-semibold mb-3">Question</h2>

          <p className="text-slate-600 font-medium">Question placeholder</p>

          <p className="mt-3 text-sm text-slate-600">
            Session ID: {sessionId || "Not available yet"}
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 flex flex-col">
          <h2 className="text-lg font-semibold mb-3">Code Editor</h2>

          <textarea
            className="flex-1 border rounded-lg p-3 font-mono text-sm"
            placeholder="Write your solution here..."
          />

          <button
            onClick={handleLeaveSession}
            className="mt-4 bg-red-500 text-white py-2 rounded-lg hover:bg-red-600"
          >
            Leave Session
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
              setState("idle");
              setCountdown(null);
              setProposedMatch(null);
              setSessionId("");
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
