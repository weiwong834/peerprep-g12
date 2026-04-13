const API_BASE =
  import.meta.env.VITE_AI_EXPLANATIONS_SERVICE_URL || "http://localhost:4000";

export type AIExplanationType =
  | "EXPLAIN_QUESTION"
  | "HINT"
  | "EXPLAIN_CODE";

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
    throw new Error(JSON.stringify(data));
    // throw new Error(data?.error || "AI service request failed");
  }

  return data;
}

export async function getRemainingRequests(
  sessionId: string,
  userId: string
) {
  return authFetch<{ remainingRequests: number }>(
    `${API_BASE}/ai/remaining?sessionId=${sessionId}&userId=${userId}`,
    {
      method: "GET",
    }
  );
}

/**
 * Request AI explanation from backend
 */
export async function getAiExplanation(
  type: AIExplanationType,
  question: string,
  code: string,
  sessionId: string,
  userId: string
) {
  return authFetch<{ 
    response: string;
    remainingRequests: number;
   }>(`${API_BASE}/ai/explain`, {
    method: "POST",
    body: JSON.stringify({
      type,
      question,
      code,
      sessionId,
      userId,
    }),
  });
}