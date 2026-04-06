import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import * as Y from "yjs";
import type { Session } from "../services/collaborationService";
import type { Question } from "../services/questionService";

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
  username,
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
  const [partnerJoined, setPartnerJoined] = useState(false);
  const [partnerDisconnected, setPartnerDisconnected] = useState(false);
  const [idleWarning, setIdleWarning] = useState("");
  const [sessionEndedMessage, setSessionEndedMessage] = useState("");
  const [earlyTerminationWarning, setEarlyTerminationWarning] = useState("");
  const [canRejoinQueue, setCanRejoinQueue] = useState(false);
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
        username,
      });
    });

    socket.on("session-joined", () => {
      setRoomMessage("Joined collaboration room.");

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

    socket.on("partner-already-present", () => {
      setPartnerJoined(true);
      setPartnerDisconnected(false);
      setRoomMessage("Your partner is already in the room.");
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
      setPartnerJoined(true);
      setPartnerDisconnected(false);
      setRoomMessage(`${username} joined the room.`);
    });

    socket.on("user-disconnected", ({ userId: disconnectedUserId }) => {
      setPartnerDisconnected(true);
      setPartnerJoined(false);
      setRoomMessage(`User ${disconnectedUserId} disconnected.`);
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
  }, [session.session_id, userId, username]);

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

  const description =
    question.blocks
      ?.filter((block) => block.block_type === "text")
      .map((block) => block.content)
      .join("\n\n") || "No question description available.";

  return (
    <div className="grid grid-cols-2 gap-6 h-[80vh]">
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

        <pre className="whitespace-pre-wrap text-sm text-slate-700">
          {description}
        </pre>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 flex flex-col">
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
          <p className="mb-2 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded p-2">
            You can rejoin the matching queue immediately.
          </p>
        )}

        <textarea
          value={code}
          onChange={(e) => handleCodeChange(e.target.value)}
          disabled={!!sessionEndedMessage}
          className="flex-1 border rounded-lg p-3 font-mono text-sm"
          placeholder="Write your solution here..."
        />

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
              className="bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
            >
              Back to Matching
            </button>
          )}
        </div>

        <div className="mt-3 text-xs text-slate-500">
          <p>Partner joined: {partnerJoined ? "Yes" : "Not yet"}</p>
          <p>Partner disconnected: {partnerDisconnected ? "Yes" : "No"}</p>
        </div>
      </div>
    </div>
  );
}
