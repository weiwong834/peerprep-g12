const API_BASE = "http://localhost:3001";

type QuestionTopic = {
  topic: string;
};

type QuestionBlock = {
  block_type: "text" | "image";
  content: string;
};

export type Question = {
  id: string;
  question_number: string | number;
  title: string;
  difficulty: string;
  availability_status: string;
  question_topics?: QuestionTopic[];
  blocks?: QuestionBlock[];
};

export type Topic = {
  name: string;
  is_empty: boolean;
};

async function questionFetch<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || "Question service request failed");
  }

  return data;
}

export async function getTopics() {
  return questionFetch<Topic[]>(`${API_BASE}/topics`);
}

export async function getQuestions(filters?: {
  topic?: string;
  difficulty?: string;
  status?: string;
}) {
  const params = new URLSearchParams();

  if (filters?.topic) params.append("topic", filters.topic);
  if (filters?.difficulty) params.append("difficulty", filters.difficulty);
  if (filters?.status) params.append("status", filters.status);

  const query = params.toString();
  const url = query
    ? `${API_BASE}/questions?${query}`
    : `${API_BASE}/questions`;

  return questionFetch<Question[]>(url);
}

export async function createQuestion(payload: {
  title: string;
  description: string;
  difficulty: string;
  topics: string[];
}) {
  return questionFetch<Question>(`${API_BASE}/questions`, {
    method: "POST",
    body: JSON.stringify({
      title: payload.title,
      difficulty: payload.difficulty,
      topics: payload.topics,
      blocks: [
        {
          block_type: "text",
          content: payload.description,
        },
      ],
    }),
  });
}

export async function editQuestion(
  questionNumber: string | number,
  payload: {
    title?: string;
    description?: string;
    difficulty?: string;
    topics?: string[];
  },
) {
  return questionFetch<Question>(`${API_BASE}/questions/${questionNumber}`, {
    method: "PATCH",
    body: JSON.stringify({
      title: payload.title,
      difficulty: payload.difficulty,
      topics: payload.topics,
      ...(payload.description !== undefined
        ? {
            blocks: [
              {
                block_type: "text",
                content: payload.description,
              },
            ],
          }
        : {}),
    }),
  });
}

export async function archiveQuestion(questionNumber: string | number) {
  return questionFetch<Question>(
    `${API_BASE}/questions/${questionNumber}/archive`,
    {
      method: "PATCH",
    },
  );
}

export async function restoreQuestion(questionNumber: string | number) {
  return questionFetch<Question>(
    `${API_BASE}/questions/${questionNumber}/restore`,
    {
      method: "PATCH",
    },
  );
}

export async function deleteQuestion(questionNumber: string | number) {
  const response = await fetch(`${API_BASE}/questions/${questionNumber}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error || "Failed to delete question");
  }
}

export async function createTopic(name: string) {
  return questionFetch<Topic>(`${API_BASE}/topics`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}
