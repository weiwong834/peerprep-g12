// AI Assistance Disclosure:
// Tool: ChatGPT (model: GPT-5.4 Thinking), date: 2026-04-14
// Scope: Assisted with formatting edits and debugging, including matching flow UI updates and modal/error-state handling.
// Author review: I reviewed, modified, and tested the suggested changes before incorporating them into the file.
import React, { useEffect, useRef, useState } from "react";
import { MdOutlineDataArray } from "react-icons/md";
import { VscSymbolString } from "react-icons/vsc";
import { BsShare, BsShareFill } from "react-icons/bs";
import { RiTableView } from "react-icons/ri";
import { LuLayers3, LuRotateCw } from "react-icons/lu";
import { FaSort } from "react-icons/fa";
import { TbBinaryTreeFilled } from "react-icons/tb";
import { FiCheck, FiChevronDown } from "react-icons/fi";
import linkedListIcon from "../assets/linkedlist.png";
import { Listbox } from "@headlessui/react";
import { io, type Socket } from "socket.io-client";
import { getUserInfo } from "../services/userService";
import CollaborationRoom from "../components/CollaborationRoom";
import { getSession, getActiveSession, type Session } from "../services/collaborationService";
import { getQuestionById, type Question } from "../services/questionService";

type CollabState =
  | "idle"
  | "waiting"
  | "confirming"
  | "timed_out"
  | "active"

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

type TopicOption = {
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
  imageSrc?: string;
};

type DifficultyOption = {
  value: string;
  label: string;
  description: string;
  className: string;
  selectedClassName: string;
};

const TOPIC_OPTIONS: TopicOption[] = [
  { value: "Arrays", icon: MdOutlineDataArray },
  { value: "Strings", icon: VscSymbolString },
  { value: "Graphs", icon: BsShareFill },
  { value: "Trees", icon: TbBinaryTreeFilled },
  { value: "Sorting", icon: FaSort },
  { value: "Hash Tables", icon: RiTableView },
  { value: "Linked List", imageSrc: linkedListIcon },
  { value: "Recursion", icon: LuRotateCw },
  { value: "Heaps", icon: LuLayers3 },
  { value: "Tries", icon: BsShare },
];

const DIFFICULTY_OPTIONS: DifficultyOption[] = [
  {
    value: "easy",
    label: "Easy",
    description: "Good for warm-up",
    className: "border-green-200 bg-green-50 text-green-700 hover:bg-green-100",
    selectedClassName: "border-green-500 ring-2 ring-green-300 bg-green-100",
  },
  {
    value: "medium",
    label: "Medium",
    description: "Balanced challenge",
    className:
      "border-yellow-200 bg-yellow-50 text-yellow-700 hover:bg-yellow-100",
    selectedClassName: "border-yellow-500 ring-2 ring-yellow-300 bg-yellow-100",
  },
  {
    value: "hard",
    label: "Hard",
    description: "More intense practice",
    className: "border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
    selectedClassName: "border-red-500 ring-2 ring-red-300 bg-red-100",
  },
];

const LANGUAGE_OPTIONS = [
  { value: "javascript", label: "JavaScript" },
  { value: "python", label: "Python" },
  { value: "java", label: "Java" },
];

const MATCHING_SERVER_URL =
  import.meta.env.VITE_MATCHING_SERVICE_URL || "http://localhost:3002";

export default function CollabPage() {
  const socketRef = useRef<Socket | null>(null);
  const suppressNextDisconnectMessageRef = useRef(false);
  const disconnectWarningTimeoutRef = useRef<number | null>(null);
  const pendingRequeueRef = useRef(false);

  const [state, setState] = useState<CollabState>("idle");
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [showDisconnectedWarning, setShowDisconnectedWarning] = useState(false);

  const [userId, setUserId] = useState("");
  const [username, setUsername] = useState("");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [language, setLanguage] = useState("javascript");

  const [message, setMessage] = useState("");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [returnCountdown, setReturnCountdown] = useState<number | null>(null);
  const [sessionId, setSessionId] = useState("");
  const [proposedMatch, setProposedMatch] = useState<CandidateMatch | null>(
    null,
  );
  const [showMatchInterruptedModal, setShowMatchInterruptedModal] =
    useState(false);
  const [showGenericErrorModal, setShowGenericErrorModal] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [isEnteringRoom, setIsEnteringRoom] = useState(false);
  const [isRoomLoading, setIsRoomLoading] = useState(false);

  const [showBanModal, setShowBanModal] = useState(false);

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

      if (disconnectWarningTimeoutRef.current !== null) {
        clearTimeout(disconnectWarningTimeoutRef.current);
        disconnectWarningTimeoutRef.current = null;
      }

      setShowDisconnectedWarning(false);
      setIsConnected(true);
      console.log("Connected to matching service:", socket.id);

      if (pendingRequeueRef.current) {
        pendingRequeueRef.current = false;

        socket.emit("match_request", {
          userId,
          criteria: {
            topic,
            difficulty,
            language,
          },
        });

        setState("waiting");
        setMessage("Rejoining matching queue...");
        return;
      }

      setState("idle");
      setMessage("");
    });

    socket.on("disconnect", (reason) => {
      if (mountedRef && !mountedRef.current) return;
      setIsConnected(false);
      console.log("Disconnected from matching service:", reason);

      if (suppressNextDisconnectMessageRef.current) {
        suppressNextDisconnectMessageRef.current = false;
        return;
      }

      if (disconnectWarningTimeoutRef.current !== null) {
        clearTimeout(disconnectWarningTimeoutRef.current);
      }

      disconnectWarningTimeoutRef.current = window.setTimeout(() => {
        setShowDisconnectedWarning(true);
        setMessage("Disconnected from matching service.");
        disconnectWarningTimeoutRef.current = null;
      }, 1500);
    });

    socket.on("connect_error", (error) => {
      if (mountedRef && !mountedRef.current) return;
      console.error("Socket connection error:", error);
      setIsConnected(false);
      setState("idle");
      setShowGenericErrorModal(true);
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
            setState("idle");
            setShowGenericErrorModal(true);
            setMessage("Match found but no session ID was returned.");
          }
          break;

        case "match_success":
          setProposedMatch(null);
          setConfirmationChoice(null);
          if (payload.sessionId) {
            void loadSessionRoom(payload.sessionId);
          } else {
            setState("idle");
            setShowGenericErrorModal(true);
            setMessage("Match succeeded but no session ID was returned.");
          }
          break;

        case "match_timeout":
          setProposedMatch(null);
          setSessionId("");
          setConfirmationChoice(null);
          setCountdown(null);

          if (
            (payload.message || "").toLowerCase().includes("temporarily banned")
          ) {
            setShowBanModal(true);
            setState("idle");
            setMessage(
              payload.message || "You are temporarily banned from matching.",
            );
          } else {
            setState("timed_out");
            setReturnCountdown(3);
            setMessage(payload.message || "No match found.");
          }
          break;

        case "unsuccessful_match":
          const normalisedMessage = (payload.message || "").toLowerCase();
          setProposedMatch(null);
          setSessionId("");
          setConfirmationChoice(null);
          setCountdown(null);

          if (normalisedMessage.includes("temporarily banned")) {
            setShowBanModal(true);
            setState("idle");
            setMessage(
              payload.message || "You are temporarily banned from matching.",
            );
          } else if (normalisedMessage.includes("other user disconnected")) {
            setShowMatchInterruptedModal(true);
            setState("idle");
            setMessage(
              payload.message ||
                "Match cancelled because the other user disconnected.",
            );
          } else {
            setState("idle");
            setShowGenericErrorModal(true);
            setMessage(payload.message || "Something went wrong.");
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
        } catch {}
        connectMatchingSocket(mountedRef);
      } catch (error) {
        console.error("Failed to load user info:", error);
        if (!mountedRef.current) return;
        setMessage("Failed to load user info.");
      } finally {
        if (mountedRef.current) {
          setIsBootstrapping(false);
        }
      }
    }

    void setupUserAndSocket();

    return () => {
      mountedRef.current = false;
      if (disconnectWarningTimeoutRef.current !== null) {
        clearTimeout(disconnectWarningTimeoutRef.current);
        disconnectWarningTimeoutRef.current = null;
      }
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

  useEffect(() => {
    if (state !== "timed_out" || returnCountdown === null) return;

    if (returnCountdown <= 0) {
      setState("idle");
      setReturnCountdown(null);
      setMessage("");
      return;
    }

    const timer = setTimeout(() => {
      setReturnCountdown((prev) => (prev === null ? null : prev - 1));
    }, 1000);

    return () => clearTimeout(timer);
  }, [state, returnCountdown]);

  function handleFindMatch() {
    if (!socketRef.current || !isConnected) {
      setShowGenericErrorModal(true);
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

    socketRef.current.emit("confirm_request", {
      userId,
      accepted,
    });
  }

  function resetMatchState(nextState: CollabState = "idle") {
    setState(nextState);
    setCountdown(null);
    setReturnCountdown(null);
    setProposedMatch(null);
    setSessionId("");
    setConfirmationChoice(null);
  }

  function handleLeaveSession(options?: { rejoinQueue?: boolean }) {
    const shouldRejoinQueue = !!options?.rejoinQueue;

    setSessionId("");
    setSession(null);
    setQuestion(null);
    setProposedMatch(null);
    setCountdown(null);
    setReturnCountdown(null);
    setConfirmationChoice(null);
    setShowDisconnectedWarning(false);

    if (shouldRejoinQueue) {
      pendingRequeueRef.current = true;
      setMessage("Rejoining matching queue...");
    } else {
      pendingRequeueRef.current = false;
      setMessage("");
      setState("idle");
    }

    if (!socketRef.current || !socketRef.current.connected) {
      connectMatchingSocket();
    } else if (shouldRejoinQueue) {
      socketRef.current.emit("match_request", {
        userId,
        criteria: {
          topic,
          difficulty,
          language,
        },
      });

      pendingRequeueRef.current = false;
      setState("waiting");
    } else {
      setState("idle");
    }
  }

  async function loadSessionRoom(targetSessionId: string) {
    try {
      setIsEnteringRoom(true);
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
      setState("idle");
      setShowGenericErrorModal(true);
      setMessage(
        error instanceof Error
          ? error.message
          : "Failed to load collaboration session.",
      );
    } finally {
      setIsRoomLoading(false);
      setIsEnteringRoom(false);
    }
  }

  const showMatchingBase =
    state === "idle" || state === "waiting" || state === "confirming" || state === "timed_out"; 

  const showWaitingModal = state === "waiting";
  const showConfirmingModal = state === "confirming";
  const showTimeoutModal = state === "timed_out";

  if (showMatchingBase) {
    return (
      <div className="max-w-6xl relative">
        <div
          className={`transition duration-200 ${
            showWaitingModal ||
            showConfirmingModal ||
            showTimeoutModal ||
            showBanModal ||
            showMatchInterruptedModal ||
            showGenericErrorModal
              ? "blur-sm pointer-events-none select-none"
              : ""
          }`}
        >
          <h1 className="text-2xl font-bold mb-6">Start Collaboration</h1>
          <div className="bg-white p-6 rounded-2xl shadow-sm space-y-6">
            {showDisconnectedWarning && !isConnected && (
              <p className="text-sm text-red-500">
                Not connected to matching service.
              </p>
            )}

            {message && state === "idle" && (
              <p className="text-sm text-slate-600">{message}</p>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-[1.8fr_1fr] gap-8">
              {/* LEFT SIDE: TOPICS */}
              <div>
                <label className="block text-sm font-medium mb-3">Topic</label>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {TOPIC_OPTIONS.map((topicOption) => {
                    const isSelected = topic === topicOption.value;
                    const Icon = topicOption.icon;

                    return (
                      <button
                        key={topicOption.value}
                        type="button"
                        onClick={() => setTopic(topicOption.value)}
                        className={`rounded-xl border p-4 min-h-[120px] flex flex-col items-center justify-center text-center gap-3 transition ${
                          isSelected
                            ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200"
                            : "border-slate-200 hover:border-indigo-300 hover:bg-slate-50"
                        }`}
                      >
                        {topicOption.imageSrc ? (
                          <img
                            src={topicOption.imageSrc}
                            alt={topicOption.value}
                            className="w-10 h-10 object-contain"
                          />
                        ) : Icon ? (
                          <Icon className="w-10 h-10 text-indigo-600" />
                        ) : null}

                        <span className="text-sm font-medium text-slate-800">
                          {topicOption.value}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* RIGHT SIDE: DIFFICULTY + LANGUAGE */}
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-3">
                    Difficulty
                  </label>

                  <div className="space-y-3">
                    {DIFFICULTY_OPTIONS.map((option) => {
                      const isSelected = difficulty === option.value;

                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setDifficulty(option.value)}
                          className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                            option.className
                          } ${isSelected ? option.selectedClassName : ""}`}
                        >
                          <div className="font-semibold">{option.label}</div>
                          <div className="text-xs opacity-80">
                            {option.description}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Language
                  </label>

                  <Listbox
                    value={language}
                    onChange={(value) => setLanguage(value)}
                  >
                    <div className="relative">
                      <Listbox.Button className="relative w-full rounded-xl border border-slate-300 bg-white px-3 py-3 pr-10 text-left text-slate-800 shadow-sm transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200">
                        <span>
                          {
                            LANGUAGE_OPTIONS.find(
                              (option) => option.value === language,
                            )?.label
                          }
                        </span>
                        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-500">
                          <FiChevronDown className="h-5 w-5" />
                        </span>
                      </Listbox.Button>

                      <Listbox.Options className="absolute z-20 mt-2 max-h-60 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg focus:outline-none">
                        {LANGUAGE_OPTIONS.map((option) => (
                          <Listbox.Option
                            key={option.value}
                            value={option.value}
                            className={({ active }) =>
                              `relative cursor-pointer select-none px-4 py-3 ${
                                active
                                  ? "bg-indigo-50 text-indigo-700"
                                  : "text-slate-700"
                              }`
                            }
                          >
                            {({ selected }) => (
                              <div className="flex items-center justify-between">
                                <span
                                  className={
                                    selected ? "font-medium" : "font-normal"
                                  }
                                >
                                  {option.label}
                                </span>
                                {selected && (
                                  <FiCheck className="h-4 w-4 text-indigo-600" />
                                )}
                              </div>
                            )}
                          </Listbox.Option>
                        ))}
                      </Listbox.Options>
                    </div>
                  </Listbox>
                </div>

                <button
                  onClick={handleFindMatch}
                  disabled={
                    !topic ||
                    !difficulty ||
                    !language ||
                    !isConnected ||
                    isBootstrapping
                  }
                  className="w-full bg-indigo-600 text-white py-3 rounded-xl font-medium hover:bg-indigo-700 disabled:bg-gray-300"
                >
                  Find Match
                </button>
              </div>
            </div>
          </div>
        </div>

        {(showWaitingModal ||
          showConfirmingModal ||
          showTimeoutModal ||
          showBanModal ||
          showMatchInterruptedModal ||
          showGenericErrorModal) && (
          <div className="absolute inset-0 z-10 flex items-center justify-center">
            <div className="absolute inset-0 rounded-2xl bg-white/30" />

            <div className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-xl border border-slate-200 p-6 text-center space-y-4">
              {showWaitingModal && (
                <>
                  <h2 className="text-xl font-semibold text-slate-800">
                    Finding a Peer...
                  </h2>

                  <div className="text-sm text-slate-500 space-y-1">
                    <p>
                      Topic: <strong>{topic}</strong>
                    </p>
                    <p>
                      Difficulty: <strong>{difficulty}</strong>
                    </p>
                    <p>
                      Language: <strong>{language}</strong>
                    </p>
                  </div>

                  {countdown !== null && (
                    <p className="text-sm text-slate-500">
                      Timeout in{" "}
                      <span className="font-semibold text-red-500">
                        {countdown}s
                      </span>
                    </p>
                  )}

                  <div className="animate-pulse text-indigo-600 font-medium">
                    Searching...
                  </div>

                  <button
                    onClick={handleCancelQueue}
                    className="mt-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                </>
              )}

              {showConfirmingModal && (
                <>
                  <h2 className="text-xl font-semibold text-slate-800">
                    Confirm Match
                  </h2>

                  <p className="text-slate-700 font-medium">
                    {message || "An imperfect match was found."}
                  </p>

                  {proposedMatch?.resolvedCriteria && (
                    <div className="text-sm text-slate-600 space-y-1">
                      <p>
                        Topic:{" "}
                        <strong>{proposedMatch.resolvedCriteria.topic}</strong>
                      </p>
                      <p>
                        Difficulty:{" "}
                        <strong>
                          {proposedMatch.resolvedCriteria.difficulty}
                        </strong>
                      </p>
                      <p>
                        Language:{" "}
                        <strong>
                          {proposedMatch.resolvedCriteria.language}
                        </strong>
                      </p>
                    </div>
                  )}

                  {countdown !== null && !isEnteringRoom && (
                    <p className="text-sm text-slate-500">
                      Expires in{" "}
                      <span className="font-semibold text-red-500">
                        {countdown}s
                      </span>
                    </p>
                  )}

                  {confirmationChoice === "accepted" && !isEnteringRoom && (
                    <p className="text-sm text-green-600">
                      You accepted the match. Waiting for the other user...
                    </p>
                  )}

                  {confirmationChoice === "declined" && !isEnteringRoom && (
                    <p className="text-sm text-red-600">
                      You declined this match.
                    </p>
                  )}

                  {isEnteringRoom ? (
                    <p className="text-sm text-indigo-600 font-medium">
                      Match confirmed. Entering collaboration room...
                    </p>
                  ) : (
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleConfirmMatch(true)}
                        className={`w-full py-2 rounded-lg transition ${
                          confirmationChoice === "accepted"
                            ? "bg-green-200 text-green-800 ring-2 ring-green-500"
                            : "bg-indigo-600 text-white hover:bg-indigo-700"
                        }`}
                      >
                        Accept Match
                      </button>

                      <button
                        onClick={() => handleConfirmMatch(false)}
                        className={`w-full py-2 rounded-lg border transition ${
                          confirmationChoice === "declined"
                            ? "bg-red-100 text-red-700 border-red-300 ring-2 ring-red-400"
                            : "hover:bg-slate-50"
                        }`}
                      >
                        Decline Match
                      </button>
                    </div>
                  )}
                </>
              )}

              {showTimeoutModal && (
                <>
                  <h2 className="text-xl font-semibold text-slate-800">
                    No Match Found
                  </h2>

                  <p className="text-slate-600">
                    Returning to matching page in{" "}
                    <span className="font-semibold text-indigo-600">
                      {returnCountdown}
                    </span>
                    ...
                  </p>

                  <button
                    onClick={() => {
                      setState("idle");
                      setReturnCountdown(null);
                      setMessage("");
                    }}
                    className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700"
                  >
                    Return Now
                  </button>
                </>
              )}

              {showBanModal && (
                <>
                  <h2 className="text-xl font-semibold text-slate-800">
                    Matching Unavailable
                  </h2>

                  <p className="text-slate-600">
                    {message || "You are temporarily banned from matching."}
                  </p>

                  <button
                    onClick={() => {
                      setShowBanModal(false);
                      setMessage("");
                    }}
                    className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700"
                  >
                    OK
                  </button>
                </>
              )}

              {showMatchInterruptedModal && (
                <>
                  <h2 className="text-xl font-semibold text-slate-800">
                    Partner Unavailable
                  </h2>

                  <p className="text-slate-600">
                    {message ||
                      "Match cancelled because the other user disconnected."}
                  </p>

                  <button
                    onClick={() => {
                      setShowMatchInterruptedModal(false);
                      setMessage("");
                      setState("idle");
                    }}
                    className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700"
                  >
                    Back to Matching
                  </button>
                </>
              )}

              {showGenericErrorModal && (
                <>
                  <h2 className="text-xl font-semibold text-slate-800">
                    Something went wrong
                  </h2>

                  <p className="text-slate-600">
                    {message || "An unexpected error occurred."}
                  </p>

                  <button
                    onClick={() => {
                      setShowGenericErrorModal(false);
                      setMessage("");
                      setState("idle");
                    }}
                    className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700"
                  >
                    Back to Matching
                  </button>
                </>
              )}
            </div>
          </div>
        )}
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

  return null;
}
