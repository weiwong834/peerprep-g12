import express from "express";
import {
  signup,
  login,
  logout,
  getUserInfo,
  updateUsername,
  checkUniqueUsername,
  updateUserRole,
  getAllUsers,
  deleteOwnAccount,
  requestPasswordReset,
  resetPassword,

} from "../controllers/authController.js";

import { requireAuth, requireAdmin } from "../middleware/userMiddleware.js";
import { validateUsername, validatePassword } from "../middleware/fieldValidation.js";

const router = express.Router();

// authentication routes
router.post("/auth/signup", validateUsername, validatePassword, signup);
router.post("/auth/login", login);
router.post("/auth/logout", requireAuth, logout);

// user profile routes
router.get("/user/getUserInfo", requireAuth, getUserInfo);
router.patch("/user/username", requireAuth, updateUsername);
router.get("/user/checkUniqueUsername", checkUniqueUsername);
router.delete("/user/deleteAccount", requireAuth, deleteOwnAccount);

// admin routes
router.patch("/admin/role/:userId", requireAuth, requireAdmin, updateUserRole);
router.get("/admin/allUsers", requireAuth, requireAdmin, getAllUsers);

// password reset
router.post("/auth/requestResetPassword", requestPasswordReset);
router.post("/auth/resetPassword", validatePassword, resetPassword);

export default router;