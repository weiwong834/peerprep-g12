import { getRedisClient } from '../config/redis';
import { ChatMessage } from '../models/message';

const CHAT_KEY_PREFIX = 'chat:';
const MESSAGE_TTL = 60 * 60 * 24;

export async function saveMessage(message: ChatMessage): Promise<void> {
  const client = getRedisClient();
  const key = `${CHAT_KEY_PREFIX}${message.session_id}`;
  await client.rpush(key, JSON.stringify(message));
  await client.expire(key, MESSAGE_TTL);
}

export async function getMessages(sessionId: string): Promise<ChatMessage[]> {
  const client = getRedisClient();
  const key = `${CHAT_KEY_PREFIX}${sessionId}`;
  const raw = await client.lrange(key, 0, -1);
  return raw.map((m) => JSON.parse(m) as ChatMessage);
}

export async function deleteMessages(sessionId: string): Promise<void> {
  const client = getRedisClient();
  const key = `${CHAT_KEY_PREFIX}${sessionId}`;
  await client.del(key);
}