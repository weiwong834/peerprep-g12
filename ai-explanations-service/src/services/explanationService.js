import { callClaude } from "./claudeService.js";

const prompt_rules = `
IMPORTANT RULES:
- DO NOT use markdown formatting
- DO NOT use symbols like #, **, *, or backticks
- DO NOT use code blocks (no \`\`\`)
- Write everything in plain text
- If showing code, just write it normally without any formatting labels like "python"
- Keep formatting simple and readable
- Do not ask any questions back to me
- Give me a response that is strictly below 200 words
`;

export const generateExplanation = async (type, question, code) => {
  let prompt;

  switch (type) {
    case "EXPLAIN_QUESTION":
      prompt = `Explain the following programming problem clearly, without giving the solution or hints to the solution.` 
        + prompt_rules 
        + `\n${question}`;
      break;

    case "HINT":
      prompt = `
      Give 1 single hint (not solution) for this problem:` 
        + prompt_rules 
        + `\n${question}\nCode:\n${code}`;
      break;

    case "EXPLAIN_CODE":
      prompt = `
      Explain what this code does, and do not give me hints or solutions to the next steps:` 
        + prompt_rules 
        + `\n${code}`;
      break;

    default:
      throw new Error("Invalid type");
  }

  return await callClaude(prompt);
};