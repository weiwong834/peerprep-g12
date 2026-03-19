import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import * as sessionService from '../services/sessionService';
import { CreateSessionDTO } from '../models/session';

// called (by matching svc) to create new collab room
export const createSession = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const dto: CreateSessionDTO = req.body;

    // validate required fields
    const required = ['user1_id', 'user2_id', 'language', 'difficulty', 'topic'];
    const missing = required.filter((field) => !dto[field as keyof CreateSessionDTO]);
    if (missing.length > 0) {
      res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
      return;
    }

    const session = await sessionService.createSession(dto);
    res.status(201).json(session);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// called (by frontend?) to get a specific session
export const getSession = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const sessionId = req.params['sessionId'] as string;
    const session = await sessionService.getSessionById(sessionId);

    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    // ensure user is part of this session
    const userId = req.user?.id;
    if (session.user1_id !== userId && session.user2_id !== userId) {
      res.status(403).json({ error: 'Unauthorised access to session' });
      return;
    }

    res.status(200).json(session);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// to check if user has an active session to rejoin (as per F11.2.2)
export const getActiveSession = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.id!;
    const session = await sessionService.getActiveSessionByUserId(userId);

    if (!session) {
      res.status(404).json({ error: 'No active session found' });
      return;
    }

    res.status(200).json(session);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const endSession = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const sessionId = req.params['sessionId'] as string;
    const session = await sessionService.getSessionById(sessionId);

    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    // ensure user is part of this session
    const userId = req.user?.id;
    if (session.user1_id !== userId && session.user2_id !== userId) {
      res.status(403).json({ error: 'Unauthorised access to session' });
      return;
    }

    const updated = await sessionService.endSession(sessionId);
    res.status(200).json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};