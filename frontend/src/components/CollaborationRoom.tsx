import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import * as Y from "yjs";
import Editor from "@monaco-editor/react";
import type { Session } from "../services/collaborationService";
import type { Question } from "../services/questionService";
import { getAiExplanation, getRemainingRequests } from "../services/aiExplanationsService";
import type { AIExplanationType } from "../services/aiExplanationsService";

const COLLAB_SERVER_URL =
  import.meta.env.VITE_COLLAB_SERVICE_URL || "http://localhost:3003";

type Props = {
  session: Session;
  question: Question;
  userId: string;
  username: string;
  onLeave: () => void;
};

export default function CollaborationRoom({
  session,
  question,
  userId,
  username: currentUsername,
  onLeave,
}: Props) {
  const socketRef = useRef<Socket | null>(null);

  const ydocRef = useRef<Y.Doc | null>(null);
  const ytextRef = useRef<Y.Text | null>(null);
  const pendingRestoredCodeRef = useRef<string | null>(null);
  const initialSyncResolvedRef = useRef(false);
  const syncFallbackTimeoutRef = useRef<number | null>(null);

  const [code, setCode] = useState("");
  const [roomMessage, setRoomMessage] = useState("");
  const [partnerName, setPartnerName] = useState<string>("");
  const [partnerConnected, setPartnerConnected] = useState(false);
  const [idleWarning, setIdleWarning] = useState("");
  const [sessionEndedMessage, setSessionEndedMessage] = useState("");
  const [earlyTerminationWarning, setEarlyTerminationWarning] = useState("");
  const [canRejoinQueue, setCanRejoinQueue] = useState(false);
  const [aiResponse, setAIResponse] = useState("");
  const [remainingRequests, setRemainingRequests] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  type TabType = "Partner Chat" | "AI Chat" | "AI Explanations";
  const [activeTab, setActiveTab] = useState<TabType>("Partner Chat");

  useEffect(() => {
    const socket = io(COLLAB_SERVER_URL, {
      transports: ["websocket"],
    });

    socketRef.current = socket;

    const ydoc = new Y.Doc();
    const ytext = ydoc.getText("code");
    ydocRef.current = ydoc;
    ytextRef.current = ytext;

    const handleYTextChange = () => {
      setCode(ytext.toString());
    };

    ytext.observe(handleYTextChange);

    const handleYDocUpdate = (update: Uint8Array, origin: unknown) => {
      if (
        origin === "remote" ||
        origin === "restore" ||
        origin === "reset-before-sync"
      ) {
        return;
      }

      const socketInstance = socketRef.current;
      if (!socketInstance) return;

      socketInstance.emit("yjs-update", {
        sessionId: session.session_id,
        update: Array.from(update),
      });

      console.log("EMIT save-code", {
        sessionId: session.session_id,
        code: ytext.toString(),
      });
      
      socketInstance.emit("save-code", {
        sessionId: session.session_id,
        code: ytext.toString(),
      });
    };

    ydoc.on("update", handleYDocUpdate);

    socket.on("connect", () => {
      console.log("Connected to collaboration service:", socket.id);

      socket.emit("join-session", {
        sessionId: session.session_id,
        userId,
        username: currentUsername,
      });
    });

    socket.on("session-joined", () => {
      setRoomMessage("");

      initialSyncResolvedRef.current = false;

      socket.emit("request-sync", {
        sessionId: session.session_id,
      });

      syncFallbackTimeoutRef.current = window.setTimeout(() => {
        if (initialSyncResolvedRef.current) return;

        const pendingCode = pendingRestoredCodeRef.current;
        if (!pendingCode) return;
        if (ytext.length > 0) return;

        ydoc.transact(() => {
          ytext.insert(0, pendingCode);
        }, "restore");

        pendingRestoredCodeRef.current = null;
        initialSyncResolvedRef.current = true;
        syncFallbackTimeoutRef.current = null;
      }, 500);
    });

    socket.on("partner-already-present", ({ username }: { username?: string}) => {
      if (username && username !== currentUsername) {
        setPartnerName(username);
      }
      setPartnerConnected(true);
      setRoomMessage("");
    });

    socket.on("code-restored", ({ code }: { code: string }) => {
      if (!code) return;
      pendingRestoredCodeRef.current = code;
    });

    socket.on(
      "sync-requested",
      ({ fromSocketId }: { fromSocketId: string }) => {
        const fullState = Y.encodeStateAsUpdate(ydoc);

        socket.emit("sync-response", {
          sessionId: session.session_id,
          targetSocketId: fromSocketId,
          update: Array.from(fullState),
        });
      },
    );

    socket.on("sync-response", ({ update }: { update: number[] }) => {
      if (syncFallbackTimeoutRef.current !== null) {
        clearTimeout(syncFallbackTimeoutRef.current);
        syncFallbackTimeoutRef.current = null;
      }

      const currentText = ytext.toString();
      if (currentText.length > 0) {
        ydoc.transact(() => {
          ytext.delete(0, currentText.length);
        }, "reset-before-sync");
      }

      const incoming = new Uint8Array(update);
      Y.applyUpdate(ydoc, incoming, "remote");
      pendingRestoredCodeRef.current = null;
      initialSyncResolvedRef.current = true;
    });

    socket.on("user-joined", ({ username }: { username: string }) => {
      if (username !== currentUsername) {
        setPartnerName(username);
      }
      setPartnerConnected(true);
      setRoomMessage("");
    });

    socket.on("user-disconnected", ({ username }: { username: string }) => {
      if (username && username !== currentUsername) {
        setPartnerName(username);
      }
      setPartnerConnected(false);
      setRoomMessage("");
    });

    socket.on("idle-warning", ({ message }: { message: string }) => {
      setIdleWarning(message);
    });

    socket.on(
      "session-ended",
      ({ message }: { message: string; endedBy?: string }) => {
        setIdleWarning("");
        setSessionEndedMessage(message || "Session ended.");
      },
    );

    socket.on("rejoin-available", ({ message }: { message: string }) => {
      setRoomMessage(message);
      setCanRejoinQueue(true);
    });

    socket.on(
      "early-termination-warning",
      ({ message }: { message: string; strikeCount?: number }) => {
        setEarlyTerminationWarning(message);
      },
    );

    socket.on("yjs-update", ({ update }: { update: number[] }) => {
      const incoming = new Uint8Array(update);
      Y.applyUpdate(ydoc, incoming, "remote");
    });

    socket.on("error", ({ message }: { message: string }) => {
      setRoomMessage(message || "Collaboration error.");
    });

    return () => {
      if (syncFallbackTimeoutRef.current !== null) {
        clearTimeout(syncFallbackTimeoutRef.current);
        syncFallbackTimeoutRef.current = null;
      }

      pendingRestoredCodeRef.current = null;
      initialSyncResolvedRef.current = false;

      ytext.unobserve(handleYTextChange);
      ydoc.off("update", handleYDocUpdate);
      ydoc.destroy();
      ydocRef.current = null;
      ytextRef.current = null;

      socket.disconnect();
      socketRef.current = null;
    };
  }, [session.session_id, userId, currentUsername]);

  useEffect(() => {
    async function fetchRemaining() {
      try {
        const data = await getRemainingRequests(
          session.session_id,
          userId
        );
        setRemainingRequests(data.remainingRequests);
      } catch (err) {
        console.error("Failed to fetch remaining requests", err);
      }
    }

    fetchRemaining();
  }, [session.session_id, userId]);

  function getEditorLanguage(language: string) {
    switch (language.toLowerCase()) {
      case "javascript":
        return "javascript";
      case "python":
        return "python";
      case "java":
        return "java";
      default:
        return "plaintext";
    }
  }

  function handleCodeChange(nextValue: string) {
    const ydoc = ydocRef.current;
    const ytext = ytextRef.current;
    if (!ydoc || !ytext) return;

    const current = ytext.toString();
    if (current === nextValue) return;

    ydoc.transact(() => {
      ytext.delete(0, current.length);
      ytext.insert(0, nextValue);
    }, "local");
  }

  function handleEndSession() {
    if (sessionEndedMessage) return;

    const startedAt = new Date(session.start_timestamp).getTime();
    const elapsedMs = Date.now() - startedAt;
    const isEarlyTerminationRisk = elapsedMs < 2 * 60 * 1000;

    const confirmed = window.confirm(
      isEarlyTerminationRisk
        ? "Are you sure you want to end this session? Ending within 2 minutes will count as an early termination strike."
        : "Are you sure you want to end this session?",
    );

    if (!confirmed) return;

    socketRef.current?.emit("end-session", {
      sessionId: session.session_id,
      userId,
    });
  }

  async function handleAIRequest(type: AIExplanationType) {
  if (type === "EXPLAIN_CODE" && (!code || code.trim().length === 0)) {
    setAIResponse("There is no code yet to explain.");
    return;
  }

  try {
    setLoading(true);

    const fullQuestion =
      question.blocks?.length
        ? question.blocks
            .filter((block) => block.block_type === "text")
            .map((block) => block.content)
            .join("\n\n")
        : question.title;

    const data = await getAiExplanation(
      type,
      fullQuestion,
      code,
      session.session_id,
      userId,
    );

    setAIResponse(data.response);
    setRemainingRequests(data.remainingRequests);
  } catch (err) {
    console.log("Error fetching AI explanation:", err);
    setAIResponse("Error fetching AI response.");
    
  } finally {
    setLoading(false);
  }
}

  return (
    <div className="grid grid-cols-3 gap-6 h-[80vh] min-h-0">
      <div className="bg-white rounded-xl shadow-sm p-6 overflow-auto">
        <h2 className="text-lg font-semibold mb-3">{question.title}</h2>

        <div className="space-y-2 text-sm text-slate-600 mb-4">
          <p>
            Topic: <strong>{session.topic}</strong>
          </p>
          <p>
            Difficulty: <strong>{session.difficulty}</strong>
          </p>
          <p>
            Language: <strong>{session.language}</strong>
          </p>
          <p>
            Session ID: <strong>{session.session_id}</strong>
          </p>
        </div>

        <div className="space-y-4">
          {question.blocks && question.blocks.length > 0 ? (
            question.blocks.map((block, index) => {
              if (block.block_type === "text") {
                return (
                  <pre
                    key={index}
                    className="whitespace-pre-wrap text-sm text-slate-700 font-sans"
                  >
                    {block.content}
                  </pre>
                );
              }

              if (block.block_type === "image") {
                return (
                  <div key={index} className="space-y-2">
                    <img
                      src={block.content}
                      alt={`Question image ${index + 1}`}
                      className="max-w-full rounded-lg border"
                    />
                  </div>
                );
              }

              return null;
            })
          ) : (
            <p className="text-sm text-slate-500">
              No question description available.
            </p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 flex flex-col min-h-0">
        <h2 className="text-lg font-semibold mb-3">Code Editor</h2>

        {roomMessage && (
          <p className="mb-2 text-sm text-slate-600">{roomMessage}</p>
        )}

        {idleWarning && (
          <p className="mb-2 text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded p-2">
            {idleWarning}
          </p>
        )}

        {sessionEndedMessage && (
          <div className="mb-3 rounded border border-red-200 bg-red-50 p-3">
            <p className="text-sm text-red-700">{sessionEndedMessage}</p>
          </div>
        )}

        {earlyTerminationWarning && (
          <p className="mb-2 text-sm text-orange-700 bg-orange-50 border border-orange-200 rounded p-2">
            {earlyTerminationWarning}
          </p>
        )}

        {canRejoinQueue && (
          <p className="mb-2 text-sm text-indigo-700 bg-indigo-50 border border-indigo-200 rounded p-2">
            You can rejoin the matching queue immediately.
          </p>
        )}

        <div className="flex-1 border rounded-lg overflow-hidden">
          <Editor
            height="100%"
            language={getEditorLanguage(session.language)}
            value={code}
            onChange={(value) => handleCodeChange(value ?? "")}
            theme="vs-light"
            options={{
              readOnly: !!sessionEndedMessage,
              minimap: { enabled: false },
              fontSize: 14,
              automaticLayout: true,
              scrollBeyondLastLine: false,
              wordWrap: "on",
              lineNumbers: "on",
              tabSize: 2,
              insertSpaces: true,
              bracketPairColorization: { enabled: true },
              padding: { top: 12 },
            }}
          />
        </div>

        <div className="mt-4 flex gap-3">
          {!sessionEndedMessage ? (
            <button
              onClick={handleEndSession}
              className="bg-red-500 text-white py-2 px-4 rounded-lg hover:bg-red-600"
            >
              End Session
            </button>
          ) : (
            <button
              onClick={onLeave}
              className="bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700"
            >
              Back to Matching
            </button>
          )}
        </div>

        <div className="mt-3 flex items-center gap-2 text-sm text-slate-600">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${
              partnerConnected
                ? "bg-green-500"
                : partnerName
                  ? "bg-red-500"
                  : "bg-slate-300"
            }`}
          />
          <span>
            Partner:{" "}
            <strong>
              {partnerName || "Waiting for partner..."}
            </strong>
          </span>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 flex flex-col min-h-0">
        <div className="flex border-b mb-3">
          <button
            onClick={() => setActiveTab("Partner Chat")}
            className={`px-3 py-2 text-sm ${
              activeTab === "Partner Chat"
                ? "border-b-2 border-indigo-500 font-medium"
                : "text-gray-500"
            }`}
          >
            Partner Chat
          </button>

          <button
            onClick={() => setActiveTab("AI Chat")}
            className={`px-3 py-2 text-sm ${
              activeTab === "AI Chat"
                ? "border-b-2 border-indigo-500 font-medium"
                : "text-gray-500"
            }`}
          >
            AI Chat
          </button>

          <button
            onClick={() => setActiveTab("AI Explanations")}
            className={`px-3 py-2 text-sm ${
              activeTab === "AI Explanations"
                ? "border-b-2 border-indigo-500 font-medium"
                : "text-gray-500"
            }`}
          >
            AI Explanations
          </button>
        </div>

        {/* {activeTab === "Partner Chat" */} 

        {/* {activeTab === "AI Chat" */}

        {activeTab === "AI Explanations" && (
          <>
            <div className="text-sm text-gray-500 mb-2">
              {remainingRequests !== null
                ? `Hints left: ${remainingRequests} / 5`
                : "Loading remaining hints..."}
            </div>

            <div className="flex flex-col gap-2 mb-4">
              <button
                onClick={() => handleAIRequest("EXPLAIN_QUESTION")}
                disabled={loading || remainingRequests === 0 || remainingRequests === null}
                className={`rounded px-3 py-2 text-sm ${
                  loading || remainingRequests === 0 || remainingRequests === null
                    ? "bg-gray-200 cursor-not-allowed"
                    : "bg-slate-100 hover:bg-slate-200"
                }`}
              >
                Explain Question
              </button>

              <button
                onClick={() => handleAIRequest("HINT")}
                disabled={loading || remainingRequests === 0 || remainingRequests === null}
                className={`rounded px-3 py-2 text-sm ${
                  loading || remainingRequests === 0 || remainingRequests === null
                    ? "bg-gray-200 cursor-not-allowed"
                    : "bg-slate-100 hover:bg-slate-200"
                }`}
              >
                Give Hint
              </button>

              <button
                onClick={() => handleAIRequest("EXPLAIN_CODE")}
                disabled={loading || remainingRequests === 0 || remainingRequests === null}
                className={`rounded px-3 py-2 text-sm ${
                  loading || remainingRequests === 0 || remainingRequests === null
                    ? "bg-gray-200 cursor-not-allowed"
                    : "bg-slate-100 hover:bg-slate-200"
                }`}
              >
                Explain Code
              </button>
            </div>

            <div className="flex-1 overflow-y-auto border rounded p-3 text-sm text-slate-700 whitespace-pre-wrap">
              {loading
                ? "Thinking..."
                : aiResponse || "Ask for help to see AI explanation."}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
