import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth';
import multer from "multer";

import {
    getAllQuestions,
    getQuestionByNumber,
    createQuestion,
    editQuestion,
    archiveQuestion,
    restoreQuestion,
    deleteQuestion,
    getQuestionById,
    uploadQuestionImage
} from '../controllers/questionController';

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();

router.post("/images/upload", requireAuth, requireAdmin, upload.single("image"), uploadQuestionImage);
router.get('/', requireAuth, requireAdmin, getAllQuestions);
router.get("/id/:questionId", requireAuth, getQuestionById);
router.get('/:questionNumber', requireAuth, requireAdmin, getQuestionByNumber);
router.post('/', requireAuth, requireAdmin, createQuestion);
router.patch('/:questionNumber', requireAuth, requireAdmin, editQuestion);
router.patch('/:questionNumber/archive', requireAuth, requireAdmin, archiveQuestion);
router.patch('/:questionNumber/restore', requireAuth, requireAdmin, restoreQuestion);
router.delete('/:questionNumber', requireAuth, requireAdmin, deleteQuestion);

export default router;