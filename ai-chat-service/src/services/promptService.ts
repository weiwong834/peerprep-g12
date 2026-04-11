import { createLogger } from "../utils/logger";

const logger = createLogger("AiChatPromptService");

type PromptContextInput = {
	language: string;
	difficulty: string;
	topic: string;
	cohesiveQuestion: string;
	codeContent: string;
	userPrompt: string;
};

export function buildPrompt(input: PromptContextInput): string {
    logger.info("Successfully prepared prompt context");

	// Placeholder prompt shape until full prompt-crafting logic is implemented.
	return [
		`Language: ${input.language}`,
		`Difficulty: ${input.difficulty}`,
		`Topic: ${input.topic}`,
		`Question: ${input.cohesiveQuestion}`,
		`Current code: ${input.codeContent}`,
		`User prompt: ${input.userPrompt}`,
	].join("\n\n");
}
