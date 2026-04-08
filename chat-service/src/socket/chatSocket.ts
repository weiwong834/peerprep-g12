import { Server, Socket } from 'socket.io';
import { saveMessage, getMessages } from '../services/chatService';
import { ChatMessage } from '../models/message';

const COLLAB_SERVICE_URL = process.env.COLLAB_SERVICE_URL || 'http://localhost:3003';
const INTERNAL_SECRET = process.env.INTERNAL_SERVICE_SECRET!;
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3000';

// Verify token AND get userId in one call via User Service
async function verifyAndGetUser(token: string): Promise<string | null> {
  try {
    const res = await fetch(`${USER_SERVICE_URL}/user/getUserInfo`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return null;
    const data = await res.json() as { id?: string };
    return data.id ?? null;
  } catch (err) {
    console.error('Failed to reach user service:', err);
    return null;
  }
}

// Check with collab service that this user has an active session
async function getActiveSession(userId: string): Promise<string | null> {
  try {
    const res = await fetch(
      `${COLLAB_SERVICE_URL}/sessions/internal/active/${userId}`,
      { headers: { 'x-internal-service-secret': INTERNAL_SECRET } }
    );
    if (!res.ok) return null;
    const data = await res.json() as { session_id?: string };
    return data.session_id ?? null;
  } catch (err) {
    console.error('Failed to reach collab service:', err);
    return null;
  }
}

export function registerChatHandlers(io: Server, socket: Socket): void {
  // Auth on connection
  socket.on('authenticate', async (token: string) => {
    try {
      const userId = await verifyAndGetUser(token);
      if (!userId) {
          socket.emit('auth-error', { message: 'Invalid token' });
          return;
      }
      const sessionId = await getActiveSession(userId);

      if (!sessionId) {
        socket.emit('auth-error', { message: 'No active session found' });
        return;
      }

      // Store on socket for use in other handlers
      (socket as any).userId = userId;
      (socket as any).sessionId = sessionId;

      // Join the session room so messages are scoped to session (N2.1.1)
      socket.join(sessionId);
      socket.emit('authenticated', { sessionId });

      // Send existing messages (in case of reconnect)
      const history = await getMessages(sessionId);
      socket.emit('chat-history', history);

      console.log(`User ${userId} joined chat room ${sessionId}`);
    } catch (err) {
      socket.emit('auth-error', { message: 'Invalid token' });
    }
  });

  // Handle incoming message
  socket.on('send-message', async (content: string) => {
    const userId = (socket as any).userId;
    const sessionId = (socket as any).sessionId;

    if (!userId || !sessionId) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }

    if (!content || typeof content !== 'string' || content.trim() === '') {
      socket.emit('error', { message: 'Message content cannot be empty' });
      return;
    }

    const message: ChatMessage = {
      session_id: sessionId,
      sender_id: userId,
      content: content.trim(),
      timestamp: new Date().toISOString(),
    };

    await saveMessage(message);

    // Broadcast to both users in the session room (N2.4 - chronological via timestamp)
    io.to(sessionId).emit('receive-message', message);
  });

  socket.on('disconnect', () => {
    const userId = (socket as any).userId;
    const sessionId = (socket as any).sessionId;
    if (userId && sessionId) {
      console.log(`User ${userId} disconnected from chat room ${sessionId}`);
    }
  });
}