import { generateExplanation } from "../services/explanationService.js";
import { createClient } from "@supabase/supabase-js";
import { fetchSessionById } from "../services/sessionService.js";
import Redis from "ioredis";

const redis = new Redis({
  host: process.env.REDIS_HOST || "redis",
  port: 6379,
});

const MAX_REQUESTS = 5;


/**
 * Validates a JWT access token using Supabase.
 *
 * Returns:
 * - User object if valid
 * - null if invalid or expired
 *
 * @param {string} authorization - Authorization header (Bearer token)
 * @returns {Object|null} Authenticated user or null
 */
const authenticateUser = async (authorization) => {
  const token = authorization.split(" ")[1];

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    }
  );

  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user) {
    return null;
  }

  return data.user;
};


/**
 * Verifies that a session exists and that the user is part of it.
 * 
 * If validation fails:
 * - Returns appropriate HTTP response via res
 *
 * If validation succeeds:
 * - Returns session object
 *
 * @param {string} sessionId - Session ID
 * @param {string} userId - Authenticated user ID
 * @param {string} authorization - Authorization header
 * @returns {Object} Session object if valid
 */
const validateSession = async (sessionId, userId, authorization) => {
  const sessionResult = await fetchSessionById(sessionId, authorization);

  if (!sessionResult.ok) {
    return res.status(sessionResult.status).json({ message: sessionResult.error });
  }

  const session = sessionResult.session;

  if (session.status !== "active") {
    return res.status(409).json({ message: "Session is not active" });
  }

  if (session.user1_id !== userId && session.user2_id !== userId) {
    return res.status(403).json({ message: "Unauthorized access to session" });
  }

  return { session };
};


/**
 * Retrieves the number of remaining AI requests for a user in a session.
 *
 * Response:
 * - remainingRequests (number of remaining hints)
 *
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 */
export const getRemainingRequests = async (req, res) => {
  const { sessionId } = req.params;
  const authorization = req.headers.authorization;

  if (!sessionId) {
    return res.status(400).json({ message: "Missing sessionId" });
  }

  if (!authorization || !authorization.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "Missing or invalid authorization header",
    });
  }

  try {
    const user = await authenticateUser(authorization);

    if (!user) {
      return res.status(401).json({
        message: "Invalid or expired token",
      });
    }

    const userId = user.id;

    const validation = await validateSession(sessionId, userId, authorization);

    if (validation.error) {
      return res.status(validation.status).json({
        message: validation.error,
      });
    }

    const key = `ai:${sessionId}:${userId}`;
    const currentCount = parseInt(await redis.get(key)) || 0;

    res.json({
      remainingRequests: MAX_REQUESTS - currentCount,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


/**
 * Generates an AI explanation and updates request usage count.
 *
 * Response:
 * - AI-generated explanation
 * - Remaining request count
 *
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 */
export const handleExplain = async (req, res) => {
  const { sessionId } = req.params;
  const { type, question, code } = req.body;
  const authorization = req.headers.authorization;

  if (!sessionId) {
    return res.status(400).json({ message: "Missing sessionId" });
  }

  if (!type) {
    return res.status(400).json({ message: "Missing type" });
  }

  if (!authorization || !authorization.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "Missing or invalid authorization header",
    });
  }

  try {
    const user = await authenticateUser(authorization);

    if (!user) {
      return res.status(401).json({
        message: "Invalid or expired token",
      });
    }

    const userId = user.id;

    const validation = await validateSession(sessionId, userId, authorization);

    if (validation.error) {
      return res.status(validation.status).json({
        message: validation.error,
      });
    }

    const key = `ai:${sessionId}:${userId}`;
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
    console.error("Error:", err);
    res.status(500).json({ message: err.message });
  }
};