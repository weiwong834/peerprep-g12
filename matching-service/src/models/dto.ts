export interface CreateSessionDTO {
  user1_id: string;
  user2_id: string;
  language: string;
  difficulty: string;
  topic: string;
  question_id?: string;
}

export type SessionStatus = 'active' | 'inactive';

export interface Session {
  session_id: string;
  user1_id: string;
  user2_id: string;
  question_id: string;
  language: string;
  difficulty: string;
  topic: string;
  start_timestamp: Date;
  end_timestamp: Date | null;
  status: SessionStatus;
  code_content: string;
}