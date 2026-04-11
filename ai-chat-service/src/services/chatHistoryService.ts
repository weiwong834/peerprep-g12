import supabase from "../config/supabase";
import { createLogger } from "../utils/logger";

const logger = createLogger("AiChatHistoryService");

type AiChatMessage = {
  content: string;
  role: string;
  timestamp: string;
};

export async function getFormattedChatHistory(
  sessionId: string,
  userId: string
): Promise<string> {

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
    return "No previous chat history for this session and user";
  }
  
  logger.info("Successfully fetched and formatted chat history", { sessionId, userId, messageCount: rows.length });
  return rows
    .map((row) => {
      const role = row.role;
      return `${role}: ${row.content}`;
    })
    .join("\n");
}
