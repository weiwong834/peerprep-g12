export type QuestionBlock = {
  block_type: "text" | "image";
  content: string;
};

export function parseQuestionDescriptionToBlocks(
  input: string,
): QuestionBlock[] {
  const blocks: QuestionBlock[] = [];
  const imageTagRegex = /\[image:(https?:\/\/[^\]\s]+)\]/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = imageTagRegex.exec(input)) !== null) {
    const fullMatch = match[0];
    const imageUrl = match[1];
    const matchIndex = match.index;

    const textBefore = input.slice(lastIndex, matchIndex).trim();
    if (textBefore) {
      blocks.push({
        block_type: "text",
        content: textBefore,
      });
    }

    blocks.push({
      block_type: "image",
      content: imageUrl,
    });

    lastIndex = matchIndex + fullMatch.length;
  }

  const remainingText = input.slice(lastIndex).trim();
  if (remainingText) {
    blocks.push({
      block_type: "text",
      content: remainingText,
    });
  }

  return blocks;
}

export function validateQuestionDescriptionTags(input: string): string | null {
  const tagPattern = /\[image:([^\]]*)\]/g;
  let match: RegExpExecArray | null;

  while ((match = tagPattern.exec(input)) !== null) {
    const imageUrl = match[1]?.trim();

    if (!imageUrl) {
      return "Image tag is missing a URL. Use [image:https://...]";
    }

    if (!/^https?:\/\/\S+$/.test(imageUrl)) {
      return `Invalid image URL in tag: ${imageUrl}`;
    }
  }

  const malformedTagPattern = /\[image[^\]]*\]?/g;
  const allImageish = input.match(malformedTagPattern) ?? [];
  const validImageTags = input.match(/\[image:https?:\/\/[^\]\s]+\]/g) ?? [];

  if (allImageish.length > validImageTags.length) {
    return "One or more image tags are malformed. Use [image:https://...]";
  }

  return null;
}
