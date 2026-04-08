import supabase from '../config/supabase';
import { Session, CreateSessionDTO, UpdateSessionDTO } from '../models/session';
import { randomUUID } from 'crypto';
import { getChannel, EXCHANGE_NAME, SESSION_ENDED_ROUTING_KEY } from '../config/rabbitmq';

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
  // check if either user already has an active session
  const user1Active = await getActiveSessionByUserId(dto.user1_id);
  const user2Active = await getActiveSessionByUserId(dto.user2_id);

  if (user1Active) throw new Error(`User ${dto.user1_id} already has an active session`);
  if (user2Active) throw new Error(`User ${dto.user2_id} already has an active session`);
  
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
    .schema("collaborationservice")
    .from("collaboration_rooms")
    .select("*")
    .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
    .eq("status", "active")
    .order("start_timestamp", { ascending: false })
    .limit(1)
    .maybeSingle();

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
  const session = await updateSession(sessionId, {
    status: 'inactive',
    end_timestamp: new Date(),
  });

  // publish session.ended event for chat service to persist chat history
  try {
    const channel = getChannel();
    channel.publish(
      EXCHANGE_NAME,
      SESSION_ENDED_ROUTING_KEY,
      Buffer.from(JSON.stringify({ session_id: sessionId })),
      { persistent: true }
    );
    console.log(`Published session.ended for session ${sessionId}`);
  } catch (err) {
    // chat persistence failing shouldn't break session ending
    console.error('Failed to publish session.ended event:', err);
  }

  return session;
};