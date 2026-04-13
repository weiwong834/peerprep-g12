import { Request, Response } from "express";
import { createLogger } from "../utils/logger";
import { generateAiResponse } from "../services/responseService";
import { buildPrompt } from "../services/promptService";
import { fetchSessionById } from "../services/collaborationService";
import { parseQuestion } from "../services/questionService";
import { getFormattedChatHistory } from "../services/chatHistoryService";
import {
	checkAndIncrementPromptCount,
	getRemainingPromptCount,
} from "../services/promptLimitService";
import { persistPromptAndResponse } from "../services/messagePersistService";

const logger = createLogger("AiChatController");

type SendPromptBody = {
	userId?: string;
	prompt?: string;
};

type PromptCountQuery = {
  userId?: string;
};

type ChatHistoryQuery = {
	userId?: string;
};

async function validateSessionAccess(
  sessionId: string,
  userId: string,
  authorization: string,
  res: Response
) {
  const sessionResult = await fetchSessionById(sessionId, authorization);

  if (!sessionResult.ok) {
		if (sessionResult.error === "Session not found") {
			logger.warn("Session not found during prompt request", { sessionId });
			res.status(404).json({ error: "Session not found" });
			return null;
		}

		logger.warn("Failed to validate session", {
			sessionId,
			status: sessionResult.status,
			error: sessionResult.error,
		});
		res.status(sessionResult.status).json({ error: sessionResult.error });
		return null;
	}

	const session = sessionResult.session;
	if (session.status !== "active") {
		logger.warn("Session is not active", { sessionId, userId, status: session.status });
		res.status(409).json({ error: "Session is not active" });
		return null;
	}

	if (session.user1_id !== userId && session.user2_id !== userId) {
		logger.warn("User does not belong to session", { sessionId, userId });
		res.status(403).json({ error: "Unauthorised access to session" });
		return null;
	}

	return session;
}

export async function sendPrompt(req: Request, res: Response): Promise<void> {
	const { sessionId } = req.params;
	const { userId, prompt } = req.body as SendPromptBody;
	const authorization = req.headers.authorization;

  // Check for required parameters and headers
	if (!sessionId) {
    logger.error("Missing sessionId in URL params");
		res.status(400).json({ error: "sessionId is required in URL params" });
		return;
	}

	if (!userId || !prompt) {
    logger.error("Missing userId or prompt in request body");
		res.status(400).json({ error: "userId and prompt are required in payload" });
		return;
	}

	if (!authorization || !authorization.startsWith("Bearer ")) {
		logger.error("Missing or invalid authorization header");
		res.status(401).json({ error: "Missing or invalid authorization header" });
		return;
	}

	try {
		const session = await validateSessionAccess(
			sessionId,
			userId,
			authorization,
			res
		);
		if (!session) return;
    
		// Check prompt limit
		const promptLimitResult = await checkAndIncrementPromptCount(sessionId, userId);
		if (!promptLimitResult.allowed) {
			logger.warn("Prompt limit exceeded", {
				sessionId,
				userId,
				count: promptLimitResult.count,
				limit: promptLimitResult.limit,
			});
			res.status(429).json({
				error: `Exceeded prompt limit of ${promptLimitResult.limit} for this session`,
			});
			return;
		}

		const { questionTitle, questionContent } = await parseQuestion(
			session.question_id,
			authorization
		);
		const chatHistory = await getFormattedChatHistory(sessionId, userId);

    // Send session info and user prompt to prompt service to craft the prompt
		const craftedPrompt = buildPrompt({
			language: session.language,
			topic: session.topic,
			questionTitle,
			questionContent,
			codeContent: session.code_content,
			chatHistory,
			userPrompt: prompt,
		});

    // Send crafted prompt to response service to get AI response
		const aiResponse = await generateAiResponse({
			sessionId,
			userId,
			promptPayload: craftedPrompt,
		});

		// Persist user prompt and AI response asynchronously
		void persistPromptAndResponse(sessionId, userId, prompt, aiResponse).catch((persistError) => {
			logger.error("Failed to persist AI chat exchange", {
				sessionId,
				userId,
				error:
					persistError instanceof Error
						? persistError.message
						: "Unknown error",
			});
		});

		res.status(200).json({ response: aiResponse });
	} catch (error) {
		logger.error("Failed to generate AI response", {
			sessionId,
			userId,
			error: error instanceof Error ? error.message : "Unknown error",
		});
		res.status(502).json({ error: "Failed to get response from AI service" });
	}
}

export async function getPromptCount(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;
  const { userId } = req.query as PromptCountQuery;
  const authorization = req.headers.authorization;

  if (!sessionId) {
    logger.error("Missing sessionId in URL params");
		res.status(400).json({ error: "sessionId is required in URL params" });
		return;
	}

	if (!userId) {
		logger.error("Missing userId in query params");
		res.status(400).json({ error: "userId is required in query params" });
		return;
	}

	if (!authorization || !authorization.startsWith("Bearer ")) {
		logger.error("Missing or invalid authorization header");
		res.status(401).json({ error: "Missing or invalid authorization header" });
		return;
	}

	try {
		const session = await validateSessionAccess(
			sessionId,
			userId,
			authorization,
			res
		);
		if (!session) return;

		const promptCount = await getRemainingPromptCount(sessionId, userId);

		res.status(200).json({
			count: promptCount.count,
			limit: promptCount.limit,
			remainingRequests: promptCount.remainingRequests,
		});
	} catch (error) {
		logger.error("Failed to fetch prompt count", {
			sessionId,
			userId,
			error: error instanceof Error ? error.message : "Unknown error",
		});
		res.status(502).json({ error: "Failed to get prompt count" });
	}
}

export async function getChatHistory(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;
  const { userId } = req.query as ChatHistoryQuery;
  const authorization = req.headers.authorization;

  if (!sessionId) {
    logger.error("Missing sessionId in URL params");
		res.status(400).json({ error: "sessionId is required in URL params" });
		return;
  }

	if (!userId) {
		logger.error("Missing userId in query params");
		res.status(400).json({ error: "userId is required in query params" });
		return;
	}

	if (!authorization || !authorization.startsWith("Bearer ")) {
		logger.error("Missing or invalid authorization header");
		res.status(401).json({ error: "Missing or invalid authorization header" });
		return;
	}

	try {
		const session = await validateSessionAccess(
			sessionId,
			userId,
			authorization,
			res
		);
		if (!session) return;

		const chatHistory = await getFormattedChatHistory(sessionId, userId);

		res.status(200).json({ messages: chatHistory });
	} catch (error) {
		logger.error("Failed to fetch AI chat history", {
			sessionId,
			userId,
			error: error instanceof Error ? error.message : "Unknown error",
		});
		res.status(502).json({ error: "Failed to get chat history" });
	}
}

