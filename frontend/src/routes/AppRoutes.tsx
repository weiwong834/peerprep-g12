import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";

import LoginPage from "../pages/LoginPage";
import SignupPage from "../pages/SignupPage";
import ForgotPasswordPage from "../pages/ForgotPasswordPage";
import ResetPasswordPage from "../pages/ResetPasswordPage";
import HomePage from "../pages/HomePage";
import ProfilePage from "../pages/ProfilePage";
import CollaborationPage from "../pages/CollabPage";
import AdminPage from "../pages/AdminPage";
import VerifiedPage from "../pages/VerifiedPage";
import AttemptHistoryPage from "../pages/AttemptHistoryPage";

import AppLayout from "../components/layout/AppLayout";

/**
 * temporary auth check
 */
const isAuthenticated = () => {
  return localStorage.getItem("accessToken") !== null;
};

const isAdmin = () => {
  return localStorage.getItem("isAdmin") === "true";
};

function AdminRoute({ children }: { children: ReactNode }) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin()) {
    return <Navigate to="/home" replace />;
  }

  return children;
}

/**
 * protects routes that require login
 */
function ProtectedRoute({ children }: { children: ReactNode }) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        {/* default route */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/verified" element={<VerifiedPage />} />

        {/* Protected layout */}
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/home" element={<HomePage />} />
          <Route path="/attempt/:sessionId" element={<AttemptHistoryPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/collab" element={<CollaborationPage />} />
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminPage />
              </AdminRoute>
            }
          />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
