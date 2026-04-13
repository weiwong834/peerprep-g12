import supabase from "../config/supabase";
import { createLogger } from "../utils/logger";

const logger = createLogger("AiChatPersistService");

type AiChatRole = "user" | "assistant";

type PersistMessage = {
  session_id: string;
  user_id: string;
  content: string;
  timestamp: string;
  role: AiChatRole;
};

export async function persistPromptAndResponse(
  sessionId: string,
  userId: string,
  userPrompt: string,
  aiResponse: string
): Promise<void> {
  const now = Date.now();

  const rows: PersistMessage[] = [
    {
      session_id: sessionId,
      user_id: userId,
      content: userPrompt,
      timestamp: new Date(now).toISOString(),
      role: "user",
    },
    {
      session_id: sessionId,
      user_id: userId,
      content: aiResponse,
      timestamp: new Date(now + 1).toISOString(),
      role: "assistant",
    },
  ];

  const { error } = await supabase
    .schema("aichatservice")
    .from("ai_chat_messages")
    .insert(rows);

  if (error) {
    logger.error("Failed to persist AI chat messages", {
      sessionId,
      userId,
      error: error.message,
    });
    throw new Error(`Failed to persist AI chat messages: ${error.message}`);
  }

  logger.info("Persisted user prompt and AI response", {
    sessionId,
    userId,
  });
}
