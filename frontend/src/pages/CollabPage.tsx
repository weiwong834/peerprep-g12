import { useEffect, useState } from "react";

type CollabState = "idle" | "waiting" | "matched" | "active";

export default function CollabPage() {
  const [state, setState] = useState<CollabState>("idle");

  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("");

  const [countdown, setCountdown] = useState(10);

  function handleFindMatch() {
    if (!topic || !difficulty) return;

    setState("waiting");

    // mock backend response: match found after 3 seconds
    setTimeout(() => {
      setState("matched");
      setCountdown(10);
    }, 3000);
  }

  function handleCancelQueue() {
    setState("idle");
  }

  function handleEnterRoom() {
    // later this should call backend:
    // "I accept the match"
    // backend only returns success when both users accepted

    setState("active");
  }

  function handleLeaveSession() {
    setState("idle");
    setTopic("");
    setDifficulty("");
  }

  // countdown for matched popup
  useEffect(() => {
    if (state !== "matched") return;

    if (countdown <= 0) {
      setState("idle");
      setTopic("");
      setDifficulty("");
      return;
    }

    const timer = setTimeout(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [state, countdown]);

  // ---------------- IDLE ----------------
  if (state === "idle") {
    return (
      <div className="max-w-xl">
        <h1 className="text-2xl font-bold mb-6">Start Collaboration</h1>

        <div className="bg-white p-6 rounded-xl shadow-sm space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Topic</label>
            <select
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
            >
              <option value="">Select topic</option>
              <option value="arrays">Arrays</option>
              <option value="strings">Strings</option>
              <option value="graphs">Graphs</option>
              <option value="dp">Dynamic Programming</option>
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

          <button
            onClick={handleFindMatch}
            disabled={!topic || !difficulty}
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
          >
            Find Match
          </button>
        </div>
      </div>
    );
  }

  // ---------------- WAITING ----------------
  if (state === "waiting") {
    return (
      <div className="max-w-xl">
        <h1 className="text-2xl font-bold mb-6">Finding a Peer...</h1>

        <div className="bg-white p-6 rounded-xl shadow-sm text-center space-y-4">
          <p className="text-slate-600">Matching you with another user.</p>

          <p className="text-sm text-slate-500">
            Topic: <strong>{topic}</strong>
          </p>

          <p className="text-sm text-slate-500">
            Difficulty: <strong>{difficulty}</strong>
          </p>

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

  // ---------------- MATCHED POPUP ----------------
  if (state === "matched") {
    return (
      <div className="max-w-xl">
        <h1 className="text-2xl font-bold mb-6">Match Found</h1>

        <div className="bg-white p-6 rounded-xl shadow-sm text-center space-y-4 border border-green-200">
          <h2 className="text-xl font-semibold text-slate-800">
            Hohoho, we've found you a match!
          </h2>

          <p className="text-slate-600">
            Press <strong>Enter Room</strong> to join the collaboration session.
          </p>

          <p className="text-sm text-slate-500">
            This match will expire in{" "}
            <span className="font-semibold text-red-500">{countdown}s</span>
          </p>

          <button
            onClick={handleEnterRoom}
            className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700"
          >
            Enter Room
          </button>

          <button
            onClick={handleCancelQueue}
            className="w-full border py-2 rounded-lg hover:bg-gray-100"
          >
            Decline Match
          </button>
        </div>
      </div>
    );
  }

  // ---------------- ACTIVE SESSION ----------------
  if (state === "active") {
    return (
      <div className="grid grid-cols-2 gap-6 h-[80vh]">
        <div className="bg-white rounded-xl shadow-sm p-6 overflow-auto">
          <h2 className="text-lg font-semibold mb-3">Question</h2>

          <p className="text-slate-600 font-medium">Two Sum</p>

          <p className="mt-3 text-sm text-slate-600">
            Given an array of integers nums and an integer target, return the
            indices of the two numbers such that they add up to target.
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

  return null;
}
