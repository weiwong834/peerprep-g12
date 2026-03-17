import { supabase } from '../supabaseClient';
import { Request, Response } from 'express'; 

/**
 * Retrieves all topics from the database.
 * 
 * @route GET /topics
 * @access Public
 * @param req : Request received
 * @param res : Response given 
 * @returns {Array} List of all topic objects 
 */
export async function getAllTopics(req: Request, res: Response) {
    const { data, error } = await supabase
        .from('topics')
        .select('*');
    
        if (error) {
            return res.status(500).json({ error: error.message });
        }

        return res.status(200).json(data); 
}