import { generateExplanation } from "../services/explanationService.js";
import Redis from "ioredis";

const redis = new Redis({
  host: process.env.REDIS_HOST || "redis",
  port: 6379,
});

const MAX_REQUESTS = 5;

export const getRemainingRequests = async (req, res) => {
  const { sessionId, userId } = req.query;

  if (!sessionId || !userId) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const key = `ai:${sessionId}:${userId}`;

  try {
    const currentCount = parseInt(await redis.get(key)) || 0;

    res.json({
      remainingRequests: MAX_REQUESTS - currentCount,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const handleExplain = async (req, res) => {
  const { type, question, code, sessionId, userId } = req.body;

  if (!type || !sessionId || !userId) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const allowedTypes = ["EXPLAIN_QUESTION", "HINT", "EXPLAIN_CODE"];
  if (!allowedTypes.includes(type)) {
    return res.status(400).json({ message: "Invalid type" });
  }

  const key = `ai:${sessionId}:${userId}`;

  try {
    const currentCount = parseInt(await redis.get(key)) || 0;

    if (currentCount >= MAX_REQUESTS) {
      return res.status(403).json({
        message: "Limit reached",
        remainingRequests: 0,
      });
    }

    await redis.set(key, currentCount + 1);

    const result = await generateExplanation(type, question, code);

    res.json({
      response: result,
      remainingRequests: MAX_REQUESTS - (currentCount + 1),
    });

  } catch (err) {
    console.error("Redis error:", err);
    res.status(500).json({ message: err.message });
  }
};