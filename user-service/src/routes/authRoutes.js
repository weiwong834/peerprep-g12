import express from "express";
import {
  signup,
  login,
  logout,
  getUserInfo,
  updateUsername,
  checkUniqueUsername,
  updateUserRole,
  getAllUsers
} from "../controllers/authController.js";

import { requireAuth, requireAdmin } from "../middleware/userMiddleware.js";

const router = express.Router();

// authentication routes
router.post("/auth/signup", signup);
router.post("/auth/login", login);
router.post("/auth/logout", requireAuth, logout);

// user profile routes
router.get("/user/getUserInfo", requireAuth, getUserInfo);
router.patch("/user/username", requireAuth, updateUsername);
router.get("/user/checkUniqueUsername", checkUniqueUsername);

// admin routes
router.patch("/admin/role/:userId", requireAuth, requireAdmin, updateUserRole);
router.get("/admin/allUsers", requireAuth, requireAdmin, getAllUsers);

export default router;