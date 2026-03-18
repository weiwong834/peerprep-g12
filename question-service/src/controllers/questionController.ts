import { diff } from "node:util";
import { supabase } from "../supabaseClient";
import { Request, Response } from 'express';

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
        .schema('questionservice')
        .from('questions')
        .select(`*, question_topics(topic)`) //join
        .in('availability_status', ['available', 'archived']);

    if (difficulty) query = query.eq('difficulty', difficulty);
    if (status) {
        if (!['available', 'archived'].includes(status as string)) {
        return res.status(400).json({ error: 'Invalid status. Must be available or archived.'})
        }
        query = query.eq('availability_status', status);
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({error: error.message});

    //if filtered by topic
    const result = topic
        ? data.filter((q: any) => 
            q.question_topics.some((qt: any) => qt.topic === topic)
        )
        : data;
    
        return res.status(200).json(result); 
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
        .schema('questionservice')
        .from('questions')
        .select(`*, question_topics(topic)`)
        .eq('question_number', questionNumber)
        .in('availability_status', ['available', 'archived'])
        .single();
    
    if (error || !data) {
        return res.status(404).json({error: 'Question not found'});
    }

    return res.status(200).json(data)
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
    const { title, description, difficulty, topics } = req.body;

    //F8.1.1 -- Validate all required fields are present 
    if (!title || !description || !difficulty || !topics) {
        return res.status(400).json({error: 'The question is missing required fields'}); 
    }

    //jic for now, might not need this later when UI directly allows selection from a list
    if (!['easy', 'medium', 'hard'].includes(difficulty)) {
        return res.status(400).json({error: 'Difficulty must be: easy, medium or hard'});
    }

    //same as difficulty
    const { data: existingTopics, error: topicError } = await supabase
        .schema('questionservice')
        .from('topics')
        .select('name')
        .in('name', topics);
    
    if (topicError) return res.status(500).json({ error: topicError.message });

    //if all topics exist, counts will match, if any invalid topics, counts differ
    if (existingTopics.length !== topics.length) {
        //foundNames are topic names that exist
        const foundNames = existingTopics.map((t: any) => t.name);
        const invalid = topics.filter((t: string) => !foundNames.includes(t));
        return res.status(400).json({ error: `These topics do not exist: ${invalid.join(', ')}`});
    }

    //Inserting question
    const { data: newQuestion, error: insertError} = await supabase
        .schema('questionservice')
        .from('questions')
        .insert({ title, description, difficulty, availability_status: 'available'})
        .select()
        .single();
    
    if (insertError) return res.status(500).json({ error: insertError.message});

    //Link topics in question_topics table 
    const topicLinks = topics.map((topic: string) => ({
        question_id: newQuestion.id,
        topic
    }));

    const { error: linkError } = await supabase
        .schema('questionservice')
        .from('question_topics')
        .insert(topicLinks);
    
    if (linkError) return res.status(500).json({ error: linkError.message });

    return res.status(201).json(newQuestion);
}

/**
 * Edits an existing question using a versioning strategy. 
 * Marks the current version as superseded and creates a new available version
 * with the same question number and updated content. 
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
    const { title, description, difficulty, topics } = req.body; 

    //At least one field must be provided (uh, might change this logic later)
    if (!title && !description && !difficulty && !topics) {
        return res.status(400).json({ error: 'Please provide at least one field to update.'});
    }

    //Validate difficulty if provided 
    if (difficulty && !['easy', 'medium', 'hard'].includes(difficulty)) {
        return res.status(400).json({ error: 'Difficulty must be: easy, medium or hard'});
    }

    //Validate topics if provided 
    if (topics && topics.length > 0) {
        const { data: existingTopics, error: topicError } = await supabase
            .schema('questionservice')
            .from('topics')
            .select('name')
            .in('name', topics);
        
        if (topicError) return res.status(500).json({ error: topicError.message });

        if (existingTopics.length !== topics.length) {
            const foundNames = existingTopics.map((t: any) => t.name);
            const invalid = topics.filter((t: string) => !foundNames.includes(t));
            return res.status(400).json({ error: `These topics do not exist: ${invalid.join(', ')}` });
        }
    }

    //Fetch current available version of question
    const { data: current, error: fetchError } = await supabase
        .schema('questionservice')
        .from('questions')
        .select(`*, question_topics(topic)`)
        .eq('question_number', questionNumber)
        .eq('availability_status', 'available')
        .single();
    
    if (fetchError || !current) {
        return res.status(404).json({ error: `Error fetching question number ${questionNumber}.`});
    }

    //Checking if any changes have been made
    const currentTopics = current.question_topics.map((qt: any) => qt.topic).sort();
    const incomingTopics = (topics ?? currentTopics).slice().sort();

    const nothingChanged = 
        (title ?? current.title) === current.title &&
        (description ?? current.description) === current.description &&
        (difficulty ?? current.difficulty) === current.difficulty &&
        JSON.stringify(currentTopics) === JSON.stringify(incomingTopics);
    
    if (nothingChanged) {
        return res.status(200).json({ message: 'No changes detected, question was not modified', question: current });
    }

    //Mark old version as superseded
    const { error : supersededError } = await supabase
        .schema('questionservice')
        .from('questions')
        .update({ availability_status: 'superseded' })
        .eq('id', current.id); 
    
    if (supersededError) return res.status(500).json({ error: supersededError.message });

    //Create new version inheriting the same question_number
    const { data: newVersion, error: insertError } = await supabase
        .schema('questionservice')
        .from('questions')
        .insert({ 
            question_number: current.question_number,
            title: title ?? current.title,
            description: description ?? current.description,
            difficulty: difficulty ?? current.difficulty,
            availability_status: 'available'
        })
        .select()
        .single();
    
    if (insertError) return res.status(500).json({ error: insertError.message });

    const topicsToLink = topics ?? current.question_topics.map((qt: any) => qt.topic);
    const topicLinks = topicsToLink.map((topic: string) => ({
        question_id: newVersion.id,
        topic
    }));

    const { error: linkError } = await supabase
        .schema('questionservice')
        .from('question_topics')
        .insert(topicLinks);

    if (linkError) return res.status(500).json({ error: linkError.message });

    return res.status(200).json(newVersion);
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
        .schema('questionservice')
        .from('questions')
        .select('*')
        .eq('question_number', questionNumber)
        .eq('availability_status', 'available')
        .single();

    if (fetchError || !current) {
        return res.status(404).json({ error: `No available question found with question number ${questionNumber}.`});
    }

    const { data, error } = await supabase
        .schema('questionservice')
        .from('questions')
        .update({ availability_status: 'archived'})
        .eq('id', current.id)
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
        .schema('questionservice')
        .from('questions')
        .select('*')
        .eq('question_number', questionNumber)
        .eq('availability_status', 'archived')
        .single();

    if (fetchError || !current) {
        return res.status(404).json({ error: `No archived question found with question number ${questionNumber}.`})
    }

    const { data, error } = await supabase
        .schema('questionservice')
        .from('questions')
        .update({ availability_status: 'available' })
        .eq('id', current.id)
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
        .schema('questionservice')
        .from('questions')
        .select('id, availability_status')
        .eq('question_number', questionNumber)
        .single();

    if (fetchError || !current) {
        return res.status(404).json({ error: 'Question not found'});
    }

    if (current.availability_status !== 'archived') {
        return res.status(400).json({ error: 'Question is not archived. Only archived questions can be permanently deleted.'});
    }

    const { error } = await supabase
        .schema('questionservice')
        .from('questions')
        .delete()
        .eq('id', current.id);

    if (error) return res.status(500).json({ error: error.message });

    return res.status(204).send();
}