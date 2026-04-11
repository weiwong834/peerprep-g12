import { Request, Response } from "express";
import { createLogger } from "../utils/logger";
import { generateAiResponse } from "../services/responseService";
import { buildPrompt } from "../services/promptService";
import { fetchSessionById } from "../services/collaborationService";
import { parseQuestion } from "../services/questionService";

const logger = createLogger("AiChatController");

type SendPromptBody = {
	userId?: string;
	prompt?: string;
};

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
		const sessionResult = await fetchSessionById(sessionId, authorization);

    // Check if session is successfully fetched
		if (!sessionResult.ok) {
			if (sessionResult.error === "Session not found") {
				logger.warn("Session not found during prompt request", { sessionId });
				res.status(404).json({ error: "Session not found" });
				return;
			}

			logger.warn("Failed to validate session", {
				sessionId,
				status: sessionResult.status,
				error: sessionResult.error,
			});
			res.status(sessionResult.status).json({ error: sessionResult.error });
			return;
		}

    // Check if session is currently active
		const session = sessionResult.session;
		if (session.status !== "active") {
			logger.warn("Session is not active", { sessionId, userId, status: session.status });
			res.status(409).json({ error: "Session is not active" });
			return;
		}

    // Check if user is part of the session
		if (session.user1_id !== userId && session.user2_id !== userId) {
			logger.warn("User does not belong to session", { sessionId, userId });
			res.status(403).json({ error: "Unauthorised access to session" });
			return;
		}

		const cohesiveQuestion = await parseQuestion(session.question_id, authorization);

    // Send session info and user prompt to prompt service to craft the prompt
		const craftedPrompt = buildPrompt({
			language: session.language,
			difficulty: session.difficulty,
			topic: session.topic,
			cohesiveQuestion,
			codeContent: session.code_content,
			userPrompt: prompt,
		});

    // Send crafted prompt to response service to get AI response
		const aiResponse = await generateAiResponse({
			sessionId,
			userId,
			prompt: craftedPrompt,
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

