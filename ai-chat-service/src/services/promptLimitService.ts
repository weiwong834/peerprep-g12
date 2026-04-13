import redisClient from "../config/redis";
import { createLogger } from "../utils/logger";

const logger = createLogger("PromptLimitService");

const PROMPT_LIMIT = 15;
const PROMPT_LIMIT_TTL = 24 * 60 * 60; // 24 hours in seconds

export async function checkAndIncrementPromptCount(
  sessionId: string,
  userId: string
): Promise<{ allowed: boolean; count: number; limit: number }> {
  const key = `prompt:${sessionId}:${userId}`;

  try {
    // Increment prompt count and reset TTL
    const result = await redisClient
      .multi()
      .incr(key)
      .expire(key, PROMPT_LIMIT_TTL)
      .exec();

    const count = Number(result?.[0] ?? 0);

    logger.info("Incremented prompt rate limit counter", {
      sessionId,
      userId,
      count,
      limit: PROMPT_LIMIT,
    });

    // Check if count exceeds limit
    const allowed = count <= PROMPT_LIMIT;

    if (!allowed) {
      logger.warn("User exceeded prompt limit for session", {
        sessionId,
        userId,
        count,
        limit: PROMPT_LIMIT,
      });
    } else {
      logger.info("Prompt limit check passed", {
        sessionId,
        userId,
        count,
        limit: PROMPT_LIMIT,
      });
    }

    return {
      allowed,
      count,
      limit: PROMPT_LIMIT,
    };
  } catch (error) {
    logger.error("Failed to check prompt rate limit", {
      sessionId,
      userId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw new Error("Failed to validate prompt rate limit");
  }
}

export async function getRemainingPromptCount(
  sessionId: string,
  userId: string
): Promise<{ count: number; limit: number; remainingRequests: number }> {
  const key = `prompt:${sessionId}:${userId}`;

  try {
    const currentCount = Number((await redisClient.get(key)) ?? 0);
    const count = Number.isFinite(currentCount) && currentCount > 0 ? currentCount : 0;
    const remainingRequests = Math.max(0, PROMPT_LIMIT - count);

    return {
      count,
      limit: PROMPT_LIMIT,
      remainingRequests,
    };
  } catch (error) {
    logger.error("Failed to fetch prompt count", {
      sessionId,
      userId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw new Error("Failed to fetch prompt count");
  }
}
