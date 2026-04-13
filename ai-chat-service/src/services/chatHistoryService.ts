import supabase from "../config/supabase";
import { createLogger } from "../utils/logger";

const logger = createLogger("AiChatHistoryService");

export type ChatHistory = {
  role: "user" | "assistant";
  content: string;
};

type AiChatMessage = {
  content: string;
  role: "user" | "assistant";
  timestamp: string;
};

export async function getFormattedChatHistory(
  sessionId: string,
  userId: string
): Promise<ChatHistory[]> {

  const { data, error } = await supabase
    .schema("aichatservice")
    .from("ai_chat_messages")
    .select("content, role, timestamp")
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .order("timestamp", { ascending: true });

  if (error) {
    logger.error("Failed to fetch AI chat history", { sessionId, userId, error: error.message });
    throw new Error(`Failed to fetch AI chat history: ${error.message}`);
  }

  const rows = (data ?? []) as AiChatMessage[];
  if (rows.length === 0) {
    logger.info("No previous chat history found", { sessionId, userId });
    return [];
  }

  logger.info("Successfully fetched and formatted chat history", { sessionId, userId, messageCount: rows.length });

  return rows
    .map((row) => {
      return {
        role: row.role,
        content: row.content,
      };
    });
}
