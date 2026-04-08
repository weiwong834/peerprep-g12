export interface ChatMessage {
  id?: string;
  session_id: string;
  sender_id: string;
  content: string;
  timestamp: string; // ISO string
}