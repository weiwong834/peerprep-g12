// AI Assistance Disclosure:
// Tool: ChatGPT (model: GPT-5.4 Thinking), date: 2026-04-14
// Scope: Assisted with formatting edits, mainly page overflow issue
// Author review: I reviewed, modified, and tested the suggested changes before incorporating them into the file.
import { useCallback, useEffect, useRef, useState } from "react";
import { ChatBubbleLeftRightIcon } from "@heroicons/react/24/outline";
import { io, type Socket } from "socket.io-client";
import * as Y from "yjs";
import Editor from "@monaco-editor/react";
import Chat from "./Chat";
import type { Session } from "../services/collaborationService";
import type { Question } from "../services/questionService";
import {
  getAiExplanation,
  getRemainingRequests,
} from "../services/aiExplanationsService";
import type { AIExplanationType } from "../services/aiExplanationsService";
import {
  getAiChatHistory,
  getRemainingPromptCount,
  sendPromptToAiChat,
} from "../services/aiChatService";
import QuestionDisplay from "../components/QuestionDisplay";

const COLLAB_SERVER_URL =
  import.meta.env.VITE_COLLAB_SERVICE_URL || "http://localhost:3003";

type Props = {
  session: Session;
  question: Question;
  userId: string;
  username: string;
  onLeave: (options?: { rejoinQueue?: boolean }) => void;
};

type AiChatMessage = {
  role: "user" | "assistant";
  content: string;
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
  const [idleCountdown, setIdleCountdown] = useState<number | null>(null);
  const idleCountdownIntervalRef = useRef<number | null>(null);
  const [sessionEndedMessage, setSessionEndedMessage] = useState("");
  const [showEndSessionModal, setShowEndSessionModal] = useState(false);
  const [earlyTerminationWarning, setEarlyTerminationWarning] = useState("");
  const [canRejoinQueue, setCanRejoinQueue] = useState(false);
  const [aiResponse, setAIResponse] = useState("");
  const [aiChatMessages, setAiChatMessages] = useState<AiChatMessage[]>([]);
  const [aiChatHistoryLoading, setAiChatHistoryLoading] = useState(true);
  const [remainingRequests, setRemainingRequests] = useState<number | null>(
    null,
  );
  const [remainingPrompts, setRemainingPrompts] = useState<number | null>(null);
  const [promptCountLoading, setPromptCountLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);

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
      clearIdleWarningState();
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

    socket.on(
      "partner-already-present",
      ({ username }: { username?: string }) => {
        if (username && username !== currentUsername) {
          setPartnerName(username);
        }
        setPartnerConnected(true);
        setRoomMessage("");
      },
    );

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
      clearIdleWarningState();
      setIdleWarning(message);
      setIdleCountdown(30);

      idleCountdownIntervalRef.current = window.setInterval(() => {
        setIdleCountdown((prev) => {
          if (prev === null || prev <= 1) {
            if (idleCountdownIntervalRef.current !== null) {
              clearInterval(idleCountdownIntervalRef.current);
              idleCountdownIntervalRef.current = null;
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    });

    socket.on(
      "session-ended",
      ({ message }: { message: string; endedBy?: string }) => {
        clearIdleWarningState();
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
      clearIdleWarningState();
      const incoming = new Uint8Array(update);
      Y.applyUpdate(ydoc, incoming, "remote");
    });

    socket.on("error", ({ message }: { message: string }) => {
      setRoomMessage(message || "Collaboration error.");
    });

    return () => {
      clearIdleWarningState();
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
        const data = await getRemainingRequests(session.session_id);
        setRemainingRequests(data.remainingRequests);
      } catch (err) {
        console.error("Failed to fetch remaining requests", err);
      }
    }

    fetchRemaining();
  }, [session.session_id, userId]);

  useEffect(() => {
    async function fetchAiChatHistory() {
      setAiChatHistoryLoading(true);

      try {
        const data = await getAiChatHistory(session.session_id, userId);
        setAiChatMessages(data.messages);
      } catch (err) {
        console.error("Failed to fetch AI chat history", err);
        setAiChatMessages([]);
      } finally {
        setAiChatHistoryLoading(false);
      }
    }

    fetchAiChatHistory();
  }, [session.session_id, userId]);

  // Poll ai chat service backend to get remaining prompt count every 4 seconds
  const refreshRemainingPrompts = useCallback(
    async (showLoading = false) => {
      if (showLoading) {
        setPromptCountLoading(true);
      }

      try {
        const data = await getRemainingPromptCount(session.session_id, userId);
        setRemainingPrompts(data.remainingRequests);
      } catch (err) {
        console.error("Failed to fetch remaining prompts", err);
        setRemainingPrompts(null);
      } finally {
        if (showLoading) {
          setPromptCountLoading(false);
        }
      }
    },
    [session.session_id, userId],
  );

  useEffect(() => {
    void refreshRemainingPrompts(true);
  }, [refreshRemainingPrompts]);

  useEffect(() => {
    if (!isChatOpen || activeTab !== "AI Chat") {
      return;
    }

    void refreshRemainingPrompts(false);

    const intervalId = window.setInterval(() => {
      void refreshRemainingPrompts(false);
    }, 4000);

    return () => {
      clearInterval(intervalId);
    };
  }, [isChatOpen, activeTab, refreshRemainingPrompts]);

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

    clearIdleWarningState();

    ydoc.transact(() => {
      ytext.delete(0, current.length);
      ytext.insert(0, nextValue);
    }, "local");
  }

  function clearIdleWarningState() {
    setIdleWarning("");
    setIdleCountdown(null);

    if (idleCountdownIntervalRef.current !== null) {
      clearInterval(idleCountdownIntervalRef.current);
      idleCountdownIntervalRef.current = null;
    }
  }

  function handleEndSession() {
    if (sessionEndedMessage) return;
    setShowEndSessionModal(true);
  }

  function confirmEndSession() {
    socketRef.current?.emit("end-session", {
      sessionId: session.session_id,
      userId,
    });

    setShowEndSessionModal(false);
  }

  async function handleAIRequest(type: AIExplanationType) {
    if (type === "EXPLAIN_CODE" && (!code || code.trim().length === 0)) {
      setAIResponse("There is no code yet to explain.");
      return;
    }

    try {
      setLoading(true);

      const fullQuestion = question.blocks?.length
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

  async function handleSendAiChatPrompt(prompt: string): Promise<string> {
    const data = await sendPromptToAiChat(session.session_id, userId, prompt);
    void refreshRemainingPrompts(false);
    return data.response;
  }

  function appendAiChatMessage(message: AiChatMessage) {
    setAiChatMessages((prev) => [...prev, message]);
  }

  const startedAt = new Date(session.start_timestamp).getTime();
  const elapsedMs = Date.now() - startedAt;
  const isEarlyTerminationRisk = elapsedMs < 2 * 60 * 1000;

  return (
    <div className="h-[calc(100dvh-4rem)] overflow-x-auto overflow-y-hidden">
      <div
        className={`grid h-full w-full gap-3 ${
          isChatOpen ? "min-w-[900px] grid-cols-3" : "min-w-[640px] grid-cols-2"
        }`}
      >
        <div className="min-w-0 bg-white rounded-xl shadow-sm p-6 overflow-auto">
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
          <QuestionDisplay question={question} />
        </div>

        <div className="min-w-0 bg-white rounded-xl shadow-sm p-6 flex flex-col min-h-0">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Code Editor</h2>
            <button
              onClick={() => setIsChatOpen((prev) => !prev)}
              className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${
                isChatOpen
                  ? "bg-indigo-100 border-indigo-300 text-indigo-700"
                  : "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200"
              }`}
              aria-label={isChatOpen ? "Hide chat panel" : "Open chat panel"}
              title={isChatOpen ? "Hide chat" : "Need help?"}
            >
              <ChatBubbleLeftRightIcon className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {roomMessage && (
            <p className="mb-2 text-sm text-slate-600">{roomMessage}</p>
          )}

          {idleWarning && (
            <div className="mb-2 rounded border border-yellow-200 bg-yellow-50 p-3">
              <p className="text-sm font-medium text-yellow-800">
                Idle warning
              </p>
              <p className="text-sm text-yellow-700 mt-1">
                Make a change in the code editor within{" "}
                <strong>{idleCountdown ?? 30}s</strong> or the session will end.
              </p>
            </div>
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
            ) : canRejoinQueue ? (
              <>
                <button
                  onClick={() => onLeave({ rejoinQueue: true })}
                  className="bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700"
                >
                  Rejoin Queue
                </button>
                <button
                  onClick={() => onLeave()}
                  className="border border-slate-300 text-slate-700 py-2 px-4 rounded-lg hover:bg-slate-50"
                >
                  Back to Matching
                </button>
              </>
            ) : (
              <button
                onClick={() => onLeave()}
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
              <strong>{partnerName || "Waiting for partner..."}</strong>
            </span>
          </div>
        </div>

        {isChatOpen && (
          <Chat
            sessionId={session.session_id}
            userId={userId}
            username={currentUsername}
            partnerChatDisabled={!!sessionEndedMessage}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            remainingPrompts={remainingPrompts}
            promptCountLoading={promptCountLoading}
            aiChatMessages={aiChatMessages}
            aiChatHistoryLoading={aiChatHistoryLoading}
            appendAiChatMessage={appendAiChatMessage}
            onSendAiChatPrompt={handleSendAiChatPrompt}
            onAiChatMessageSent={() => {
              void refreshRemainingPrompts(false);
            }}
            remainingRequests={remainingRequests}
            loading={loading}
            handleAIRequest={handleAIRequest}
            aiResponse={aiResponse}
          />
        )}

        {showEndSessionModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
              <h3 className="text-lg font-semibold text-slate-900">
                End session?
              </h3>

              <p className="mt-2 text-sm text-slate-600">
                {isEarlyTerminationRisk
                  ? "Ending within 2 minutes will count as an early termination strike."
                  : "Are you sure you want to end this session?"}
              </p>

              <div className="mt-5 flex justify-end gap-3">
                <button
                  onClick={() => setShowEndSessionModal(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmEndSession}
                  className="rounded-lg bg-red-500 px-4 py-2 text-sm text-white hover:bg-red-600"
                >
                  End Session
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
