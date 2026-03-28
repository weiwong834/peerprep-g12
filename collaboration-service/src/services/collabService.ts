import { Server, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import redisClient from '../config/redis';
import supabase from '../config/supabase';
import * as sessionService from './sessionService';

const IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 mins (F11.6)
const IDLE_WARNING_MS = 30 * 1000; // 30 s to respond (F11.6.2)
const CODE_SAVE_INTERVAL_MS = 5000; // save code every 5 seconds (F11.4.2)

// track idle timers per session
const idleTimers: Map<string, NodeJS.Timeout> = new Map();
const idleWarningTimers: Map<string, NodeJS.Timeout> = new Map();
const codeSaveTimers: Map<string, NodeJS.Timeout> = new Map();

export const initCollabService = (httpServer: HttpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket: Socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // user joins a collaboration room
    socket.on('join-session', async ({ sessionId, userId }) => {
      try {
        const session = await sessionService.getSessionById(sessionId);
        if (!session) {
          socket.emit('error', { message: 'Session not found' });
          return;
        }

        // verify user is a participant
        if (session.user1_id !== userId && session.user2_id !== userId) {
          socket.emit('error', { message: 'Unauthorised access to session' });
          return;
        }

        // join Socket.io room
        socket.join(sessionId);
        socket.data.sessionId = sessionId;
        socket.data.userId = userId;

        // restore latest code state from Redis (F11.2.3)
        const savedCode = await redisClient.get(`session:${sessionId}:code`);
        if (savedCode) {
          socket.emit('code-restored', { code: savedCode });
        } else if (session.code_content) {
          // fallback to last Supabase save (F11.2.3)
          socket.emit('code-restored', { code: session.code_content });
          // re-populate Redis with Supabase value
          await redisClient.set(`session:${sessionId}:code`, session.code_content);
        }

        // notify partner that user has joined
        socket.to(sessionId).emit('user-joined', { userId });

        // start idle timer
        resetIdleTimer(io, sessionId);
        startCodeSaveInterval(sessionId);

        console.log(`User ${userId} joined session ${sessionId}`);
      } catch (err) {
        socket.emit('error', { message: 'Failed to join session' });
      }
    });

    // Yjs code update: broadcast to other user in room (F11.4.1)
    socket.on('yjs-update', async ({ sessionId, update, code }) => {
      // broadcast to other user
      socket.to(sessionId).emit('yjs-update', { update });

      // save latest code to redis
      await redisClient.set(`session:${sessionId}:code`, code);

      // reset idle timer on activity
      resetIdleTimer(io, sessionId);
    });

    // user ends session (F11.5)
    socket.on('end-session', async ({ sessionId, userId }) => {
    try {
      const session = await sessionService.getSessionById(sessionId);
      if (!session) {
        socket.emit('error', { message: 'Session not found' });
        return;
      }

      await sessionService.endSession(sessionId);
      clearIdleTimers(sessionId);
      stopCodeSaveInterval(sessionId);

      // check for early termination (F11.7)
      const sessionDurationMs = Date.now() - new Date(session.start_timestamp).getTime();
      const TWO_MINUTES_MS = 2 * 60 * 1000;

      if (sessionDurationMs < TWO_MINUTES_MS) {
        console.log(`Early termination detected by ${userId} in session ${sessionId}`);

        // notify Matching Service (F11.7.4)
        const terminatedAt = new Date();
        await notifyEarlyTermination(userId, sessionId, terminatedAt);

        // notify non-terminating user they can rejoin immediately (F11.7.5)
        socket.to(sessionId).emit('rejoin-available', {
          message: 'Your partner ended the session early. You can rejoin the queue immediately.',
        });
      }

      // notify partner session has ended (F11.5.1)
      socket.to(sessionId).emit('session-ended', {
        message: 'Your partner has ended the session.',
        endedBy: userId,
      });

      socket.leave(sessionId);
      console.log(`Session ${sessionId} ended by ${userId}`);
    } catch (err) {
      socket.emit('error', { message: 'Failed to end session' });
    }
  });

    // partner confirmed session end (F11.5.2)
    socket.on('confirm-session-end', ({ sessionId }) => {
      socket.leave(sessionId);
    });

    // unexpected disconnection (F11.2.2)
    socket.on('disconnect', async () => {
      const { sessionId, userId } = socket.data;
      if (sessionId && userId) {
        socket.to(sessionId).emit('user-disconnected', { userId });
        console.log(`User ${userId} disconnected from session ${sessionId}`);

      // Check if room is now empty, if so stop the interval
      const room = io.sockets.adapter.rooms.get(sessionId);
      if (!room || room.size === 0) {
        stopCodeSaveInterval(sessionId);
        clearIdleTimers(sessionId);
        console.log(`All users left session ${sessionId}, timers cleared`);
        }
      }
    });
  });

  return io;
};

const notifyEarlyTermination = async (
  terminatingUserId: string,
  sessionId: string,
  terminatedAt: Date
): Promise<void> => {
  const matchingServiceUrl = process.env.MATCHING_SERVICE_URL || 'http://localhost:3002';
  const payload = {
    userId: terminatingUserId,
    sessionId,
    terminatedAt: terminatedAt.toISOString(),
  };

  try {
    const response = await fetch(`${matchingServiceUrl}/internal/early-termination`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) throw new Error(`Matching Service responded with ${response.status}`);
    console.log(`Notified Matching Service of early termination by ${terminatingUserId}`);
  } catch (err) {
    console.error('Failed to notify Matching Service, storing for retry:', err);

    // store failed notification for retry
    const { error } = await supabase
      .schema('collaborationservice')
      .from('failed_notifications')
      .insert({
        user_id: terminatingUserId,
        session_id: sessionId,
        terminated_at: terminatedAt.toISOString(),
      });

    if (error) console.error('Failed to store failed notification:', error.message);
  }
};

// reset idle timer for a session (F11.6.1)
const resetIdleTimer = (io: Server, sessionId: string) => {
  // clear existing timers
  clearIdleTimers(sessionId);

  // set new idle timer
  const timer = setTimeout(async () => {
    // prompt both users after 10 min idle
    io.to(sessionId).emit('idle-warning', {
      message: 'You have been idle for 10 minutes. Do you want to continue?',
    });

    // no response in 30s - end session (F11.6.2)
    const warningTimer = setTimeout(async () => {
      const session = await sessionService.getSessionById(sessionId);
      if (session && session.status === 'active') {
        await sessionService.endSession(sessionId);
        io.to(sessionId).emit('session-ended', {
          message: 'Session ended due to inactivity.',
        });
        console.log(`Session ${sessionId} ended due to inactivity`);
      }
    }, IDLE_WARNING_MS);

    idleWarningTimers.set(sessionId, warningTimer);
  }, IDLE_TIMEOUT_MS);

  idleTimers.set(sessionId, timer);
};

const clearIdleTimers = (sessionId: string) => {
  const timer = idleTimers.get(sessionId);
  const warningTimer = idleWarningTimers.get(sessionId);
  if (timer) { clearTimeout(timer); idleTimers.delete(sessionId); }
  if (warningTimer) { clearTimeout(warningTimer); idleWarningTimers.delete(sessionId); }
  stopCodeSaveInterval(sessionId);
};

const startCodeSaveInterval = (sessionId: string) => {

  console.log(`Starting code save interval for session ${sessionId}`);
  // clear existing interval if any
  const existing = codeSaveTimers.get(sessionId);
  if (existing) clearInterval(existing);

  const interval = setInterval(async () => {
  try {
    const code = await redisClient.get(`session:${sessionId}:code`);
    if (code) {
      await sessionService.updateSession(sessionId, { code_content: code });
      console.log(`Code saved to Supabase for session ${sessionId}`);
    }
  } catch (err) {
    console.error(`Failed to save code for session ${sessionId}:`, err);
  }
}, CODE_SAVE_INTERVAL_MS);

  codeSaveTimers.set(sessionId, interval);
};

const stopCodeSaveInterval = (sessionId: string) => {
    const interval = codeSaveTimers.get(sessionId);
    if (interval) { clearInterval(interval); codeSaveTimers.delete(sessionId); }
};

export const startRetryJob = () => {
  setInterval(async () => {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

      // delete entries older than 1 hour (outside rolling window, no longer relevant)
      await supabase
        .schema('collaborationservice')
        .from('failed_notifications')
        .delete()
        .lt('terminated_at', oneHourAgo);

      // fetch remaining failed notifications
      const { data: pending, error } = await supabase
        .schema('collaborationservice')
        .from('failed_notifications')
        .select('*');

      if (error || !pending || pending.length === 0) return;

      console.log(`Retrying ${pending.length} failed notification(s)...`);

      for (const notification of pending) {
        const matchingServiceUrl = process.env.MATCHING_SERVICE_URL || 'http://localhost:3002';

        try {
          const response = await fetch(`${matchingServiceUrl}/internal/early-termination`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: notification.user_id,
              sessionId: notification.session_id,
              terminatedAt: notification.terminated_at,
            }),
          });

          if (response.ok) {
            // remove from failed_notifications on success
            await supabase
              .schema('collaborationservice')
              .from('failed_notifications')
              .delete()
              .eq('id', notification.id);

            console.log(`Retry successful for user ${notification.user_id}`);
          }
        } catch (err) {
          console.error(`Retry failed for user ${notification.user_id}:`, err);
        }
      }
    } catch (err) {
      console.error('Retry job error:', err);
    }
  }, 2 * 60 * 1000); // every 2 minutes

  console.log('Failed notification retry job started');
};