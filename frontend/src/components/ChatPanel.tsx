import { useEffect, useRef, useState } from "react";
import { createChatSocket, type ChatMessage } from "../services/chatService";
import type { Socket } from "socket.io-client";

type Props = {
  sessionId: string;
  userId: string;
  username: string;
  disabled?: boolean;
};

export default function ChatPanel({ sessionId, userId, username, disabled }: Props) {
  const socketRef = useRef<Socket | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) return;

    const socket = createChatSocket();
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("authenticate", token);
    });

    socket.on("authenticated", () => {
      setConnected(true);
    });

    socket.on("chat-history", (history: ChatMessage[]) => {
      setMessages(history);
    });

    socket.on("receive-message", (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
    });

    socket.on("auth-error", (err: { message: string }) => {
      console.error("Chat auth error:", err.message);
    });

    socket.on("disconnect", () => {
      setConnected(false);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [sessionId]);

  // Auto scroll to bottom on new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSend() {
    if (!input.trim() || !connected || disabled) return;
    socketRef.current?.emit("send-message", input.trim());
    setInput("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleSend();
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-2 mb-3 text-sm">
        {!connected && (
          <p className="text-xs text-red-400">Connecting...</p>
        )}
        {messages.length === 0 && (
          <p className="text-slate-400 text-xs">No messages yet.</p>
        )}
        {messages.map((msg, i) => {
          const isMe = msg.sender_id === userId;
          return (
            <div key={i} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
              <span className="text-xs text-slate-400 mb-0.5">
                {isMe ? username : "Partner"} · {new Date(msg.timestamp).toLocaleTimeString()}
              </span>
              <span
                className={`px-3 py-1.5 rounded-lg max-w-[80%] break-words ${
                  isMe ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-800"
                }`}
              >
                {msg.content}
              </span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={!connected || disabled}
          placeholder={disabled ? "Session ended" : "Type a message..."}
          className="flex-1 border rounded-lg px-3 py-2 text-sm disabled:bg-gray-50"
        />
        <button
          onClick={handleSend}
          disabled={!connected || !input.trim() || disabled}
          className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:bg-gray-300"
        >
          Send
        </button>
      </div>
    </div>
  );
}