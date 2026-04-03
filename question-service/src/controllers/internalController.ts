import { supabase } from "../supabaseClient";
import { Request, Response } from 'express'; 

/**
 * Randomly retrieves an available question matching the given topic and difficulty.
 * Called internally by the Collaboration Service after a successful match.
 * This route is NOT exposed to the frontend. 
 * 
 * @route POST /internal/questions/fetch
 * @access Internal (Collaboration Service only) 
 * @body {string} topic - The topic to fetch a question for 
 * @body {string} difficulty - The difficulty level to fetch a question for 
 * @returns {Object} A randomly selected available question object 
 */
export async function fetchQuestionForSession(req: Request, res: Response) {
    const { topic, difficulty } = req.body;

    if (!topic || !difficulty) {
        return res.status(400).json({ error: 'Topic and Difficulty are required.'});
    }

    //Find all the questions matching the topic via question_topics table
    const { data: matchingLinks, error: linkError } = await supabase
        .schema('question_service')
        .from('question_topics')
        .select('question_id')
        .eq('topic', topic);

    if (linkError) return res.status(500).json({ error: linkError.message });
    
    if (!matchingLinks || matchingLinks.length === 0) {
        return res.status(404).json({ error: `No questions found for the topic: ${topic}.` });
    }

    const questionIds = matchingLinks.map((row: any) => row.question_id);

    //From those, get only available questions matching the difficulty
    const { data: questions, error: questionError } = await supabase
        .schema('question_service')
        .from('questions')
        .select('*')
        .in('id', questionIds)
        .eq('difficulty', difficulty)
        .eq('availability_status', 'available')

    if (questionError) return res.status(500).json({ error: questionError.message });

    if (!questions || questions.length === 0) {
        return res.status(404).json({error: 'No available questions found for the given topic and difficulty.'});
    }

    //Select random question from the results
    //Flooring ensures the final value is always within the range of indexes of the questions
    const randomIndex = Math.floor(Math.random() * questions.length);
    const selected = questions[randomIndex];

    return res.status(200).json({ question_id : selected.id });
}
