import { supabase } from "../supabaseClient";
import { Request, Response } from "express";
import crypto from 'crypto';

//used for image upload
interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

/**
 * Fetches and attaches ordered blocks to an array of question objects.
 * Mutates each question in-place, adding a 'blocks' field.
 */
async function attachBlocks(questions: any[]): Promise<any[] | null> {
  if (questions.length === 0) return questions;

  const ids = questions.map((q) => q.id);

  const { data: blocks, error } = await supabase
    .schema("question_service")
    .from("question_blocks")
    .select("question_id, block_order, block_type, content")
    .in("question_id", ids)
    .order("block_order", { ascending: true });

  if (error) return null;

  //lookup table to reduce time complexity of retrieving questions
  const blockMap: Record<string, any[]> = {};

  for (const block of blocks ?? []) {
    //if first time seeing this qn, create array
    if (!blockMap[block.question_id]) blockMap[block.question_id] = [];
    blockMap[block.question_id].push(block);
  }

  return questions.map((q) => ({ ...q, blocks: blockMap[q.id] ?? [] }));
}

/**
 * Inserts ordered blocks for a given question_id.
 * block_order is derived from array index.
 */
async function insertBlocks(
  questionId: string,
  blocks: { block_type: string; content: string }[],
): Promise<{ error: any }> {
  const rows = blocks.map((b, i) => ({
    question_id: questionId,
    block_order: i,
    block_type: b.block_type,
    content: b.content,
  }));

  const { error } = await supabase
    .schema("question_service")
    .from("question_blocks")
    .insert(rows);

  return { error };
}

/**
 * Validates an array of blocks. Returns an error string if invalid, null if valid.
 */
function validateBlocks(blocks: any[]): string | null {
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return "blocks must be a non-empty array.";
  }
  for (const [i, b] of blocks.entries()) {
    if (!b.block_type || !["text", "image"].includes(b.block_type)) {
      return `Block at index ${i} has invalid block_type. Must be "text" or "image".`;
    }
    if (
      !b.content ||
      typeof b.content !== "string" ||
      b.content.trim() === ""
    ) {
      return `Block at index ${i} is missing content.`;
    }
  }
  return null;
}

/**
 * Retrieves all questions from the database with optional filters.
 * Superseded questions are never returned.
 *
 * @route GET /questions
 * @access Admin only
 * @queryparam {string} [topic] - Filter by topic name
 * @queryparam {string} [difficulty] - Filter by difficulty (easy/medium/hard)
 * @queryparam {string} [status] - Filter by status (available/archived only)
 * @returns {Array} List of matching question objects with their topics
 */
export async function getAllQuestions(req: Request, res: Response) {
  const { topic, difficulty, status } = req.query;

  // Build the query -- never show superseded questions
  let query = supabase
    .schema("question_service")
    .from("questions")
    .select(`*, question_topics(topic)`) //join
    .in("availability_status", ["available", "archived"]);

  if (difficulty) query = query.eq("difficulty", difficulty);
  if (status) {
    if (!["available", "archived"].includes(status as string)) {
      return res
        .status(400)
        .json({ error: "Invalid status. Must be available or archived." });
    }
    query = query.eq("availability_status", status);
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  //if filtered by topic
  const filtered = topic
    ? data.filter((q: any) =>
      q.question_topics.some((qt: any) => qt.topic === topic),
    )
    : data;

  //Attach blocks to all questions in. one batched query
  const withBlocks = await attachBlocks(filtered);
  if (!withBlocks)
    return res.status(500).json({ error: "Failed to fetch question blocks." });

  return res.status(200).json(withBlocks);
}

/**
 * Retrieves a single question by its question number.
 * Only returns available or archived versions, never superseded.
 *
 * @route GET /questions/:questionNumber
 * @access Admin only
 * @param {strung} questionNumber - The question number to retrieve
 * @returns {Object} The matching question object with its topics
 */
export async function getQuestionByNumber(req: Request, res: Response) {
  const { questionNumber } = req.params;

  const { data, error } = await supabase
    .schema("question_service")
    .from("questions")
    .select(`*, question_topics(topic)`)
    .eq("question_number", questionNumber)
    .in("availability_status", ["available", "archived"])
    .single();

  if (error || !data) {
    return res.status(404).json({ error: "Question not found" });
  }

  const withBlocks = await attachBlocks([data]);
  if (!withBlocks)
    return res.status(500).json({ error: "Failed to fetch question blocks." });

  return res.status(200).json(withBlocks[0]);
}

/**
 * Retrieves a single question by its UUID.
 * Returns the exact stored version, including blocks and topics.
 * Is able to access superseded questions for question history. 
 *
 * @route GET /questions/id/:questionId
 * @access Authenticated users
 * @param {string} questionId - The UUID of the question to retrieve
 * @returns {Object} The matching question object with its topics and blocks
 */
export async function getQuestionById(req: Request, res: Response) {
  const { questionId } = req.params;

  const { data, error } = await supabase
    .schema("question_service")
    .from("questions")
    .select(`*, question_topics(topic)`)
    .eq("id", questionId)
    .single();

  if (error || !data) {
    return res.status(404).json({ error: "Question not found" });
  }

  const withBlocks = await attachBlocks([data]);
  if (!withBlocks) {
    return res.status(500).json({ error: "Failed to fetch question blocks." });
  }

  return res.status(200).json(withBlocks[0]);
}

/**
 * Create a new question in the repository.
 * All fields are required. Topics must already exist in the topics table.
 *
 * @route POST /questions
 * @access Admin only
 * @body {string} title - Question description
 * @body {string} difficulty - easy/medium/hard
 * @body {string[]} topics - Array of topic names e.g. ["Arrays", "Hash Tables"]
 * @returns {Object} the newly created question object
 */
export async function createQuestion(req: Request, res: Response) {
  const { title, difficulty, topics, blocks } = req.body;

  //F8.1.1 -- Validate all required fields are present
  if (!title || !difficulty || !topics || !blocks) {
    return res
      .status(400)
      .json({ error: "The question is missing required fields" });
  }

  //jic for now, might not need this later when UI directly allows selection from a list
  if (!["easy", "medium", "hard"].includes(difficulty)) {
    return res
      .status(400)
      .json({ error: "Difficulty must be: easy, medium or hard" });
  }

  const blockError = validateBlocks(blocks);
  if (blockError) return res.status(400).json({ error: blockError });

  //same as difficulty
  const { data: existingTopics, error: topicError } = await supabase
    .schema("question_service")
    .from("topics")
    .select("name")
    .in("name", topics);

  if (topicError) return res.status(500).json({ error: topicError.message });

  //if all topics exist, counts will match, if any invalid topics, counts differ
  if (existingTopics.length !== topics.length) {
    //foundNames are topic names that exist
    const foundNames = existingTopics.map((t: any) => t.name);
    const invalid = topics.filter((t: string) => !foundNames.includes(t));
    return res
      .status(400)
      .json({ error: `These topics do not exist: ${invalid.join(", ")}` });
  }

  //Inserting question -- no more description field
  const { data: newQuestion, error: insertError } = await supabase
    .schema("question_service")
    .from("questions")
    .insert({ title, difficulty, availability_status: "available" })
    .select()
    .single();

  if (insertError) return res.status(500).json({ error: insertError.message });

  const { error: blockInsertError } = await insertBlocks(
    newQuestion.id,
    blocks,
  );
  if (blockInsertError)
    return res.status(500).json({ error: blockInsertError.message });

  //Link topics in question_topics table
  const topicLinks = topics.map((topic: string) => ({
    question_id: newQuestion.id,
    topic,
  }));

  const { error: linkError } = await supabase
    .schema("question_service")
    .from("question_topics")
    .insert(topicLinks);

  if (linkError) return res.status(500).json({ error: linkError.message });

  return res.status(201).json({ ...newQuestion, blocks });
}

/**
 * Edits an existing question using a versioning strategy.
 * Marks the current version as superseded and creates a new available version
 * with the same question number and updated content.
 * All blocks are fully replaced on edit -- partial block updates are not supported yet.
 *
 * @route PATCH /questions/:questionNumber
 * @access Admin only
 * @param {string} questionNumber - The question number to edit
 * @body {string} [title] - Updated title
 * @body {string} [description] - Updated description
 * @body {string} [difficulty] - Updated difficulty (easy/medium/hard)
 * @body {string[]} [topics] Updated array of topic names
 * @returns {Object} The newly created question version
 */
export async function editQuestion(req: Request, res: Response) {
  const { questionNumber } = req.params;
  const { title, difficulty, topics, blocks } = req.body;

  //At least one field must be provided (uh, might change this logic later)
  if (!title && !difficulty && !topics && !blocks) {
    return res
      .status(400)
      .json({ error: "Please provide at least one field to update." });
  }

  //Validate difficulty if provided
  if (difficulty && !["easy", "medium", "hard"].includes(difficulty)) {
    return res
      .status(400)
      .json({ error: "Difficulty must be: easy, medium or hard" });
  }

  //Validate blocks if description provided
  if (blocks) {
    const blockError = validateBlocks(blocks);
    if (blockError) return res.status(400).json({ error: blockError });
  }

  //Validate topics if provided
  if (topics && topics.length > 0) {
    const { data: existingTopics, error: topicError } = await supabase
      .schema("question_service")
      .from("topics")
      .select("name")
      .in("name", topics);

    if (topicError) return res.status(500).json({ error: topicError.message });

    if (existingTopics.length !== topics.length) {
      const foundNames = existingTopics.map((t: any) => t.name);
      const invalid = topics.filter((t: string) => !foundNames.includes(t));
      return res
        .status(400)
        .json({ error: `These topics do not exist: ${invalid.join(", ")}` });
    }
  }

  //Fetch current available version of question including its blocks and topics
  const { data: current, error: fetchError } = await supabase
    .schema("question_service")
    .from("questions")
    .select(`*, question_topics(topic)`)
    .eq("question_number", questionNumber)
    .eq("availability_status", "available")
    .single();

  if (fetchError || !current) {
    return res
      .status(404)
      .json({ error: `Error fetching question number ${questionNumber}.` });
  }

  //Fetch current blocks of change detection
  const { data: currentBlocks, error: blockFetchError } = await supabase
    .schema("question_service")
    .from("question_blocks")
    .select("block_order, block_type, content")
    .eq("question_id", current.id)
    .order("block_order", { ascending: true });

  if (blockFetchError)
    return res.status(500).json({ error: blockFetchError.message });

  //Checking if any changes have been made
  const currentTopics = current.question_topics
    .map((qt: any) => qt.topic)
    .sort();
  const incomingTopics = (topics ?? currentTopics).slice().sort();

  const incomingBlocks = blocks ?? currentBlocks;
  const blocksChanged =
    JSON.stringify(
      currentBlocks?.map(({ block_type, content }: any) => ({
        block_type,
        content,
      })),
    ) !==
    JSON.stringify(
      incomingBlocks?.map(({ block_type, content }: any) => ({
        block_type,
        content,
      })),
    );

  const nothingChanged =
    (title ?? current.title) === current.title &&
    (difficulty ?? current.difficulty) === current.difficulty &&
    JSON.stringify(currentTopics) === JSON.stringify(incomingTopics) &&
    !blocksChanged;

  if (nothingChanged) {
    return res
      .status(200)
      .json({
        message: "No changes detected, question was not modified",
        question: current,
      });
  }

  //Mark old version as superseded
  const { error: supersededError } = await supabase
    .schema("question_service")
    .from("questions")
    .update({ availability_status: "superseded" })
    .eq("id", current.id);

  if (supersededError)
    return res.status(500).json({ error: supersededError.message });

  //Create new version inheriting the same question_number
  const { data: newVersion, error: insertError } = await supabase
    .schema("question_service")
    .from("questions")
    .insert({
      question_number: current.question_number,
      title: title ?? current.title,
      difficulty: difficulty ?? current.difficulty,
      availability_status: "available",
    })
    .select()
    .single();

  if (insertError) return res.status(500).json({ error: insertError.message });

  //Insert new version blocks
  const blocksToInsert =
    blocks ??
    currentBlocks!.map(({ block_type, content }: any) => ({
      block_type,
      content,
    }));
  const { error: blockInsertError } = await insertBlocks(
    newVersion.id,
    blocksToInsert,
  );
  if (blockInsertError)
    return res.status(500).json({ error: blockInsertError.message });

  //Link topics for new version
  const topicsToLink =
    topics ?? current.question_topics.map((qt: any) => qt.topic);
  const topicLinks = topicsToLink.map((topic: string) => ({
    question_id: newVersion.id,
    topic,
  }));

  const { error: linkError } = await supabase
    .schema("question_service")
    .from("question_topics")
    .insert(topicLinks);

  if (linkError) return res.status(500).json({ error: linkError.message });

  return res.status(200).json({ ...newVersion, blocks: blocksToInsert });
}

/**
 * Archives a question, removing it from active use.
 * Only available questions can be archived.
 *
 * @route PATCH /questions/:questionNumber/archive
 * @access Admin only
 * @param {string} questionNumber - The question number to archive
 * @returns {Object} The updated question object
 */
export async function archiveQuestion(req: Request, res: Response) {
  const { questionNumber } = req.params;

  const { data: current, error: fetchError } = await supabase
    .schema("question_service")
    .from("questions")
    .select("*")
    .eq("question_number", questionNumber)
    .eq("availability_status", "available")
    .single();

  if (fetchError || !current) {
    return res
      .status(404)
      .json({
        error: `No available question found with question number ${questionNumber}.`,
      });
  }

  const { data, error } = await supabase
    .schema("question_service")
    .from("questions")
    .update({ availability_status: "archived" })
    .eq("id", current.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json(data);
}

/**
 * Restores an archived question back to available status.
 * Only archived questions can be restored, no superseded questions.
 *
 * @route PATCH /questions/:questionNumber/restore
 * @access Admin only
 * @param {string} questionNumber - The question number to restore
 * @returns {Object} The updated question object
 */
export async function restoreQuestion(req: Request, res: Response) {
  const { questionNumber } = req.params;

  const { data: current, error: fetchError } = await supabase
    .schema("question_service")
    .from("questions")
    .select("*")
    .eq("question_number", questionNumber)
    .eq("availability_status", "archived")
    .single();

  if (fetchError || !current) {
    return res
      .status(404)
      .json({
        error: `No archived question found with question number ${questionNumber}.`,
      });
  }

  const { data, error } = await supabase
    .schema("question_service")
    .from("questions")
    .update({ availability_status: "available" })
    .eq("id", current.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json(data);
}

/**
 * Permanently deletes an archived question from the database.
 * Only archived questions can be deleted.
 * Linked question_topics rows are automatically removed via CASCADE.
 *
 * @route DELETE /questions/:questionNumber
 * @access Admin only
 * @param {string} questionNumber - The question number to delete
 * @returns {204} No content on success
 */
export async function deleteQuestion(req: Request, res: Response) {
  const { questionNumber } = req.params;

  //Check that the question exists and is archived
  const { data: current, error: fetchError } = await supabase
    .schema("question_service")
    .from("questions")
    .select("id, availability_status")
    .eq("question_number", questionNumber)
    .eq("availability_status", "archived")
    .single();

  if (fetchError || !current) {
    return res.status(404).json({ error: "Question not found" });
  }

  if (current.availability_status !== "archived") {
    return res
      .status(400)
      .json({
        error:
          "Question is not archived. Only archived questions can be permanently deleted.",
      });
  }

  const { error } = await supabase
    .schema("question_service")
    .from("questions")
    .delete()
    .eq("id", current.id);

  if (error) return res.status(500).json({ error: error.message });

  return res.status(204).send();
}

/**
 * Uploads an image to Supabase Storage and returns the public URL. 
 * Used by the admin frontend when inserting images into question descriptions. 
 * 
 * @route POST /questions/images/upload 
 * @access Admin only
 * @body multipart/form-data with field "image"
 * @return {Object} { url: string }
 */
export async function uploadQuestionImage(req: MulterRequest, res: Response) {
  if (!req.file) {
    return res.status(400).json({ error: "No image file provided." });
  }

  const ext = req.file.originalname.split(".").pop() ?? "png";
  //give random uuid to prevent collisions if two files of the same name are uploaded.
  const filename = `${crypto.randomUUID()}.${ext}`;
  const path = `questions/${filename}`;

  const { error } = await supabase
    .storage
    .from("question-images")
    .upload(path, req.file.buffer, {
      contentType: req.file.mimetype,
    });

  if (error) return res.status(500).json({ error: error.message });

  const { data } = supabase
    .storage
    .from("question-images")
    .getPublicUrl(path);

  return res.status(200).json({ url: data.publicUrl });
}