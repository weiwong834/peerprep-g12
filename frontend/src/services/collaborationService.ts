const API_BASE =
  import.meta.env.VITE_COLLAB_SERVICE_URL || "http://localhost:3003";

export type Session = {
  session_id: string;
  user1_id: string;
  user2_id: string;
  question_id: string;
  language: string;
  difficulty: string;
  topic: string;
  start_timestamp: string;
  end_timestamp: string | null;
  status: "active" | "inactive";
  code_content: string;
};

type RequestOptions = RequestInit & {
  headers?: Record<string, string>;
};

async function authFetch<T>(
  url: string,
  options: RequestOptions = {},
): Promise<T> {
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

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error(data?.error || "Unauthorized");
    }
    throw new Error(data?.error || "Collaboration service request failed");
  }

  return data;
}

export async function getSession(sessionId: string) {
  return authFetch<Session>(`${API_BASE}/sessions/${sessionId}`, {
    method: "GET",
  });
}

export async function getActiveSession() {
  return authFetch<Session>(`${API_BASE}/sessions/active`, {
    method: "GET",
  });
}

export async function endSession(sessionId: string) {
  return authFetch<Session>(`${API_BASE}/sessions/${sessionId}/end`, {
    method: "PATCH",
  });
}

export async function getPastSessions() {
  return authFetch<Session[]>(`${API_BASE}/sessions/history`, {
    method: "GET",
  });
}