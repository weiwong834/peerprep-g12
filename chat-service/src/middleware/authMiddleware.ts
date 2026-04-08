import { Request, Response, NextFunction } from 'express';

const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3000';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
    email: string;
    isAdmin: boolean;
  };
}

export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  try {
    const response = await fetch(`${USER_SERVICE_URL}/user/getUserInfo`, {
      method: 'GET',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    const data = await response.json();
    req.user = data as { id: string; username: string; email: string; isAdmin: boolean };
    next();
  } catch (err) {
    res.status(500).json({ error: 'Failed to reach User Service' });
  }
};