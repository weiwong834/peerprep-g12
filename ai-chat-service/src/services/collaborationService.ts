export type CollaborationSession = {
  session_id: string;
  user1_id: string;
  user2_id: string;
  question_id: string;
  language: string;
  difficulty: string;
  topic: string;
  status: "active" | "inactive" | string;
  code_content: string;
};

type FetchSessionResult =
  | { ok: true; session: CollaborationSession }
  | { ok: false; status: number; error: string };

const COLLABORATION_SERVICE_URL = process.env.COLLABORATION_SERVICE_URL || "http://localhost:3003";

export async function fetchSessionById(
  sessionId: string,
  authorization: string
): Promise<FetchSessionResult> {
  const response = await fetch(
    `${COLLABORATION_SERVICE_URL}/sessions/${sessionId}`,
    {
      method: "GET",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json",
      },
    }
  );

  const rawBody = await response.text();
  const parsedBody = parseJson(rawBody);

  if (!response.ok) {
    const error =
      isRecord(parsedBody) && typeof parsedBody.error === "string"
        ? parsedBody.error
        : `Failed to fetch session from collaboration service (${response.status})`;

    return {
      ok: false,
      status: response.status,
      error,
    };
  }

  if (!isCollaborationSession(parsedBody)) {
    return {
      ok: false,
      status: 502,
      error: "Invalid session response from collaboration service",
    };
  }

  return {
    ok: true,
    session: parsedBody,
  };
}

function parseJson(raw: string): unknown {
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// Checks value is non-null object
function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

// Checks format of collab session response
function isCollaborationSession(value: unknown): value is CollaborationSession {
  if (!isRecord(value)) return false;

  return (
    typeof value.session_id === "string" &&
    typeof value.user1_id === "string" &&
    typeof value.user2_id === "string" &&
    typeof value.question_id === "string" &&
    typeof value.language === "string" &&
    typeof value.difficulty === "string" &&
    typeof value.topic === "string" &&
    typeof value.status === "string" &&
    typeof value.code_content === "string"
  );
}
