/*
AI Assistance Disclosure:
Tool: Gemini 3.1 Pro, date: 2026‐04-12
Scope: Generated PROMPT_TEMPLATE by providing predefined rules and context structure
Author review: I validated correctness and fixed minor formatting issues
*/

import { createLogger } from "../utils/logger";
import { ChatHistory } from "./chatHistoryService";

const logger = createLogger("AiChatPromptService");

type PromptContextInput = {
	language: string;
	topic: string;
	questionTitle: string;
	questionContent: string;
	codeContent: string;
	chatHistory: ChatHistory[];
	userPrompt: string;
};

export type PromptPayload = {
  systemPrompt: string;
  sessionContext: string;
  messages: ChatHistory[];
};

// Generated system prompt template with the help of Gemini 3.1 Pro
const SYSTEM_PROMPT_RULES = `You are an expert, encouraging programming tutor. Your primary goal is to help the user learn and arrive at the solution themselves through Socratic questioning and logical guidance.

You MUST strictly adhere to the following rules:

<rules>
1. NO FULL SOLUTIONS: Under no circumstances should you generate or output a complete, working solution to the user's problem.
2. HINTS OVER ANSWERS: Provide conceptual hints, point out specific logical flaws, or clarify misunderstandings about the problem constraints. Do not do the work for them.
3. MINIMIZE CODE GENERATION: Help the user walk through the logic, algorithmic thinking, or flow of the program in plain text or pseudocode.
4. ISOLATED EXAMPLES ONLY: If the user explicitly needs syntax help or asks how a specific function works, you may generate code. HOWEVER, you must only provide generic, isolated examples using variables and scenarios completely unrelated to their specific homework/problem. Never rewrite or directly edit the user's submitted code.
5. IMAGE URLs: If you encounter any URLs within the Question Content, treat them as supporting images for the problem description. Since you cannot view these images directly, rely on the surrounding text for context and do not ask the user to open or describe the link.
</rules>`;

const SYSTEM_PROMPT_CONTEXT = `<context>
Programming Language: {{PROGRAMMING_LANGUAGE}}
Question Topic: {{QUESTION_TOPIC}}
Question Title: {{QUESTION_TITLE}}
Question Content: {{QUESTION_CONTENT}}

User's Current Code:
\`\`\`{{PROGRAMMING_LANGUAGE}}
{{CODE_CONTENT}}
\`\`\``;

// Might need to later modify to separate system prompt from user prompt depending on AI API parameters
export const buildPrompt = (input: PromptContextInput): PromptPayload => {
	const sessionContext = SYSTEM_PROMPT_CONTEXT
		.split("{{PROGRAMMING_LANGUAGE}}").join(input.language)
        .replace("{{QUESTION_TOPIC}}", input.topic)
        .replace("{{QUESTION_TITLE}}", input.questionTitle)
		.replace("{{QUESTION_CONTENT}}", input.questionContent)
		.replace("{{CODE_CONTENT}}", input.codeContent);
    
		const messages = [
			...input.chatHistory,
			{
				role: "user" as const,
				content: input.userPrompt,
			},
		];

		const payload: PromptPayload = {
			systemPrompt: `${SYSTEM_PROMPT_RULES}`,
			sessionContext,
			messages,
		};
    
    logger.info("Built prompt for response generation");
		return payload;
}
