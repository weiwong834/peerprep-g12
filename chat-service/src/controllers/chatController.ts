import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { getMessages } from '../services/chatService';
import supabase from '../config/supabase';

export const getChatHistory = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const sessionId = req.params.sessionId as string;

    // Try Redis first (session still active)
    const redisMessages = await getMessages(sessionId);
    if (redisMessages.length > 0) {
      res.json({ messages: redisMessages, source: 'redis' });
      return;
    }

    // Fall back to Supabase (session already ended)
    const { data, error } = await supabase
      .schema('chatservice')
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('timestamp', { ascending: true });

    if (error) throw error;
    res.json({ messages: data, source: 'supabase' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};