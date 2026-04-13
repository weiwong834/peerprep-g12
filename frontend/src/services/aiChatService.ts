const API_BASE =
  import.meta.env.VITE_AI_CHAT_SERVICE_URL || "http://localhost:3005";

type RequestOptions = RequestInit & {
  headers?: Record<string, string>;
  timeoutMs?: number;
};

async function authFetch<T>(
  url: string,
  options: RequestOptions = {},
): Promise<T> {
  const { timeoutMs = 5000, ...requestOptions } = options;
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  const token = localStorage.getItem("accessToken");

  try {
    const response = await fetch(url, {
      ...requestOptions,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(requestOptions.headers || {}),
      },
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error(data?.error || "Unauthorized");
      }
      throw new Error(JSON.stringify(data));
    }

    return data;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Request to ai chat service timed out");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function getRemainingPromptCount(
  sessionId: string,
  userId: string,
) {
  return authFetch<{
    count: number;
    limit: number;
    remainingRequests: number;
  }>(
    `${API_BASE}/sessions/${sessionId}/promptCount?userId=${encodeURIComponent(userId)}`,
    {
      method: "GET",
    },
  ).then((data) => {
   
    return {
      count: data.count,
      limit: data.limit,
      remainingRequests: data.remainingRequests,
    };
  });
}

export async function getAiChatHistory(
  sessionId: string,
  userId: string,
) {
  return authFetch<{
    messages: Array<{
      role: "user" | "assistant";
      content: string;
    }>;
  }>(
    `${API_BASE}/sessions/${sessionId}/chatHistory?userId=${encodeURIComponent(userId)}`,
    {
      method: "GET",
    },
  );
}

export async function sendPromptToAiChat(
  sessionId: string,
  userId: string,
  prompt: string,
) {
  return authFetch<{ response: string }>(
    `${API_BASE}/sessions/${sessionId}/chat`,
    {
      method: "POST",
      timeoutMs: Number(import.meta.env.VITE_AI_CHAT_TIMEOUT_MS ?? 60000),
      body: JSON.stringify({
        userId,
        prompt,
      }),
    },
  );
}
