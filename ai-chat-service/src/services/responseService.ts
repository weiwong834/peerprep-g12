import { PromptPayload } from "./promptService";
import { createLogger } from "../utils/logger";
import { getAnthropicClient } from "../config/anthropic";

const logger = createLogger("AiChatResponseService");

type GenerateAiResponseInput = {
  sessionId: string;
  userId: string;
  promptPayload: PromptPayload;
};

export async function generateAiResponse(
  input: GenerateAiResponseInput
): Promise<string> {
  try {
    const client = getAnthropicClient();

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 800,
      system: [
        {
          type: "text",
          text: input.promptPayload.systemPrompt,
        },
        {
          type: "text",
          text: input.promptPayload.sessionContext,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: input.promptPayload.messages,
    });

    // Find the first block which has a text response
    const firstText = response.content.find((block) => block.type === "text");
    if (!firstText || !("text" in firstText)) {
      logger.warn("Anthropic response contained no text block", {
        sessionId: input.sessionId,
        userId: input.userId,
      });
      return "";
    }

    return firstText.text;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "ANTHROPIC_API_KEY is not configured"
    ) {
      logger.error("Anthropic API key is not configured", {
        sessionId: input.sessionId,
        userId: input.userId,
      });
    }

    logger.error("Failed to get AI response from Anthropic", {
      sessionId: input.sessionId,
      userId: input.userId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw new Error("Failed to generate AI response via Anthropic");
  }
}
