import express from "express";
import { handleExplain, getRemainingRequests } from "../controllers/aiController.js";

const router = express.Router();

router.post("/explain", handleExplain);
router.get("/remaining", getRemainingRequests);

export default router;