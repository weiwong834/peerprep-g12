/*
AI Assistance Disclosure:
Tool: Gemini 3.1 Pro, date: 2026‐04-12
Scope: Generated PROMPT_TEMPLATE by providing predefined rules and context structure
Author review: I validated correctness and fixed minor formatting issues
*/

import { createLogger } from "../utils/logger";

const logger = createLogger("AiChatPromptService");

type PromptContextInput = {
	language: string;
	topic: string;
	cohesiveQuestion: string;
	codeContent: string;
	chatHistory: string;
	userPrompt: string;
};

// Generated prompt template with the help of Gemini 3.1 Pro
const PROMPT_TEMPLATE = `You are an expert, encouraging programming tutor. Your primary goal is to help the user learn and arrive at the solution themselves through Socratic questioning and logical guidance.

You MUST strictly adhere to the following rules:

<rules>
1. NO FULL SOLUTIONS: Under no circumstances should you generate or output a complete, working solution to the user's problem.
2. HINTS OVER ANSWERS: Provide conceptual hints, point out specific logical flaws, or clarify misunderstandings about the problem constraints. Do not do the work for them.
3. MINIMIZE CODE GENERATION: Help the user walk through the logic, algorithmic thinking, or flow of the program in plain text or pseudocode.
4. ISOLATED EXAMPLES ONLY: If the user explicitly needs syntax help or asks how a specific function works, you may generate code. HOWEVER, you must only provide generic, isolated examples using variables and scenarios completely unrelated to their specific homework/problem. Never rewrite or directly edit the user's submitted code.
</rules>

<context>
Programming Language: {{PROGRAMMING_LANGUAGE}}
Question Topic: {{QUESTION_TOPIC}}
Question Title: {{QUESTION_TITLE}}
Question Content: {{QUESTION_CONTENT}}

User's Current Code:
\`\`\`{{PROGRAMMING_LANGUAGE}}
{{CODE_CONTENT}}
\`\`\`

Chat History:
{{CHAT_HISTORY}}
</context>

Based on the rules and context above, please respond to the user's latest prompt.

Current User Prompt:
{{USER_PROMPT}}`;

export function buildPrompt(input: PromptContextInput): string {
    logger.info("Successfully prepared prompt context");

	// Placeholder prompt shape until full prompt-crafting logic is implemented.
	return [
		`Language: ${input.language}`,
		`Topic: ${input.topic}`,
		`Question: ${input.cohesiveQuestion}`,
		`Chat history:\n${input.chatHistory}`,
		`Current code: ${input.codeContent}`,
		`User prompt: ${input.userPrompt}`,
	].join("\n\n");
}
