import supabase from '../config/supabase';
import { getMessages, deleteMessages } from './chatService';

export async function persistChatHistory(sessionId: string): Promise<void> {
  const messages = await getMessages(sessionId);

  if (messages.length === 0) {
    console.log(`No messages to persist for session ${sessionId}`);
    return;
  }

  const { error } = await supabase
    .schema('chatservice')
    .from('chat_messages')
    .insert(messages);

  if (error) {
    console.error(`Failed to persist chat for session ${sessionId}:`, error);
    throw error;
  }

  await deleteMessages(sessionId);
  console.log(`Persisted ${messages.length} messages for session ${sessionId}`);
}