import supabase from '../config/supabase';
import { Session, CreateSessionDTO, UpdateSessionDTO } from '../models/session';
import { randomUUID } from 'crypto';

const fetchQuestionFromService = async (topic: string, difficulty: string): Promise<string> => {
  const questionServiceUrl = process.env.QUESTION_SERVICE_URL || 'http://localhost:3001';
  
  const response = await fetch(`${questionServiceUrl}/internal/questions/fetch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, difficulty }),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch question from Question Service: ${response.statusText}`);
  }

  const data = await response.json() as { question_id: string };
  
  if (!data.question_id) {
    throw new Error('Question Service returned no question ID');
  }

  return data.question_id;
};

export const createSession = async (dto: CreateSessionDTO): Promise<Session> => {
  const question_id = await fetchQuestionFromService(dto.topic, dto.difficulty);

  const newSession = {
    session_id: randomUUID(),
    ...dto,
    question_id,
    start_timestamp: new Date(),
    end_timestamp: null,
    status: 'active',
    code_content: '',
  };

  const { data, error } = await supabase
    .schema('collaborationservice')
    .from('collaboration_rooms')
    .insert(newSession)
    .select()
    .single();

  if (error) throw new Error(`Failed to create session: ${error.message}`);
  return data as Session;
};

export const getSessionById = async (sessionId: string): Promise<Session | null> => {
  const { data, error } = await supabase
    .schema('collaborationservice')
    .from('collaboration_rooms')
    .select('*')
    .eq('session_id', sessionId)
    .single();

  if (error) return null;
  return data as Session;
};

export const getActiveSessionByUserId = async (userId: string): Promise<Session | null> => {
  const { data, error } = await supabase
    .schema('collaborationservice')
    .from('collaboration_rooms')
    .select('*')
    .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
    .eq('status', 'active')
    .single();

  if (error) return null;
  return data as Session;
};

export const updateSession = async (
  sessionId: string,
  dto: UpdateSessionDTO
): Promise<Session> => {
  const { data, error } = await supabase
    .schema('collaborationservice')
    .from('collaboration_rooms')
    .update(dto)
    .eq('session_id', sessionId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update session: ${error.message}`);
  return data as Session;
};

export const endSession = async (sessionId: string): Promise<Session> => {
  return updateSession(sessionId, {
    status: 'inactive',
    end_timestamp: new Date(),
  });
};