import { Router } from 'express';
import { authenticate } from '../middleware/authMiddleware';
import { getChatHistory } from '../controllers/chatController';

const router = Router();

// GET /chat/:sessionId/history
router.get('/:sessionId/history', authenticate, getChatHistory);

export default router;