import express from "express";
import { handleExplain, getRemainingRequests } from "../controllers/aiController.js";

const router = express.Router();

router.post("/sessions/:sessionId/explain", handleExplain);
router.get("/sessions/:sessionId/remaining", getRemainingRequests);

export default router;