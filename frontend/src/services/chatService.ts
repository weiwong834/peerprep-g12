import { io, type Socket } from "socket.io-client";

const CHAT_SERVICE_URL =
  import.meta.env.VITE_CHAT_SERVICE_URL || "http://localhost:3004";

export type ChatMessage = {
  session_id: string;
  sender_id: string;
  content: string;
  timestamp: string;
};

export function createChatSocket(): Socket {
  return io(CHAT_SERVICE_URL, { transports: ["websocket"] });
}

async function authFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("accessToken");
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || "Chat service request failed");
  return data;
}

export async function getChatHistory(sessionId: string) {
  return authFetch<{ messages: ChatMessage[]; source: string }>(
    `${CHAT_SERVICE_URL}/chat/${sessionId}/history`
  );
}