import { useEffect, useState } from "react";
import {
  deleteOwnAccount,
  getUserInfo,
  updateUsername,
  requestResetPassword,
} from "../services/userService";

type UserProfile = {
  id: string;
  username: string;
  email: string;
  isAdmin: boolean;
};

export default function ProfilePage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showUsernameEditor, setShowUsernameEditor] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [savingUsername, setSavingUsername] = useState(false);
  const [usernameMessage, setUsernameMessage] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [sendingResetEmail, setSendingResetEmail] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    async function loadProfile() {
      try {
        setError("");
        const data = await getUserInfo();
        console.log("Profile data from backend: ", data);
        setUser(data);
        setNewUsername(data.username);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to load profile.";
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, []);

  function validateUsername(name: string): string | null {
    if (!name) return "Please enter a username.";
    if (name.length < 3) return "Username must be at least 3 characters.";
    if (name.length > 20) return "Username must be at most 20 characters.";
    if (/\s/.test(name)) return "Username cannot contain spaces.";
    if (name !== name.toLowerCase()) return "Only lowercase letters allowed.";
    if (!/^[a-z0-9_-]+$/.test(name)) {
      return "Only letters, numbers, '-' and '_' allowed.";
    }
    return null;
  }

  const usernameValidationError = validateUsername(newUsername);

  async function handleUpdateUsername(e: React.FormEvent) {
    e.preventDefault();
    setUsernameMessage("");
    setUsernameError("");

    if (!user) return;

    if (usernameValidationError) {
      setUsernameError(usernameValidationError);
      return;
    }

    if (newUsername === user.username) {
      setUsernameMessage("Username is unchanged.");
      return;
    }

    try {
      setSavingUsername(true);
      const data = await updateUsername(newUsername);

      setUser((prev) => (prev ? { ...prev, username: data.username } : prev));
      setNewUsername(data.username);
      setUsernameMessage("Username updated successfully.");
      setShowUsernameEditor(false);
    } catch (err: any) {
      if (err?.code === "DUPLICATE_FIELD") {
        setUsernameError("Username already taken.");
      } else {
        setUsernameError(err?.message || "Failed to update username.");
      }
    } finally {
      setSavingUsername(false);
    }
  }

  async function handleDeleteAccount() {
    const confirmed = window.confirm(
      "Are you sure you want to delete your account? This action cannot be undone.",
    );

    if (!confirmed) return;

    try {
      setDeletingAccount(true);
      setDeleteError("");

      await deleteOwnAccount();

      localStorage.removeItem("accessToken");
      localStorage.removeItem("isAdmin");
      window.location.href = "/login";
    } catch (err: any) {
      if (err?.code === "LAST_ADMIN") {
        setDeleteError("You cannot delete the last remaining admin account.");
      } else {
        setDeleteError(err?.message || "Failed to delete account.");
      }
    } finally {
      setDeletingAccount(false);
    }
  }

  async function handleSendPasswordResetEmail() {
    if (!user) return;

    try {
      setSendingResetEmail(true);
      setPasswordMessage("");
      setPasswordError("");

      await requestResetPassword(user.email);
      setPasswordMessage(
        "A password reset link has been sent to your email. Please check your inbox and spam folder.",
      );
    } catch (err: any) {
      setPasswordError(err?.message || "Failed to send password reset email.");
    } finally {
      setSendingResetEmail(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="rounded-2xl bg-white p-6 shadow-md">
          <p className="text-slate-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-6">
        <div className="rounded-2xl bg-white p-6 shadow-md">
          <h1 className="text-2xl font-bold text-slate-800">Profile</h1>
          {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mx-auto max-w-2xl rounded-2xl bg-white p-8 shadow-md">
        <h1 className="text-2xl font-bold text-slate-800">Profile</h1>
        <p className="mt-1 text-sm text-slate-500">
          View your account details.
        </p>

        <div className="mt-6 space-y-4 rounded-xl bg-slate-50 p-5">
          <div>
            <p className="text-sm text-slate-500">Username</p>
            <p className="mt-1 font-medium text-slate-800">{user.username}</p>
          </div>

          <div>
            <p className="text-sm text-slate-500">Email</p>
            <p className="mt-1 font-medium text-slate-800">{user.email}</p>
          </div>

          <div>
            <p className="text-sm text-slate-500">Role</p>
            <p className="mt-1 font-medium text-slate-800">
              {user.isAdmin ? "Administrator" : "User"}
            </p>
          </div>
        </div>

        <div className="mt-8 rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">
                Change Username
              </h2>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowUsernameEditor((prev) => !prev);
                setUsernameError("");
                setUsernameMessage("");
                setNewUsername(user.username);
              }}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              {showUsernameEditor ? "Cancel" : "Change Username"}
            </button>
          </div>

          {showUsernameEditor && (
            <form onSubmit={handleUpdateUsername} className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  New Username
                </label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => {
                    setNewUsername(e.target.value);
                    setUsernameError("");
                    setUsernameMessage("");
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
                <div className="mt-1 min-h-5 text-sm">
                  {newUsername && usernameValidationError && (
                    <span className="text-red-500">
                      ✗ {usernameValidationError}
                    </span>
                  )}
                  {newUsername && !usernameValidationError && (
                    <span className="text-green-600">
                      ✓ Valid username format
                    </span>
                  )}
                </div>
              </div>

              {usernameMessage && (
                <p className="text-sm text-green-600">{usernameMessage}</p>
              )}
              {usernameError && (
                <p className="text-sm text-red-500">{usernameError}</p>
              )}

              <button
                type="submit"
                disabled={savingUsername || !!usernameValidationError}
                className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {savingUsername ? "Saving..." : "Save Username"}
              </button>
            </form>
          )}
        </div>

        <div className="mt-8 rounded-xl border border-slate-200 p-5">
          <h2 className="text-lg font-semibold text-slate-800">Password</h2>
          <p className="mt-1 text-sm text-slate-500">
            We’ll send a password reset link to your registered email.
          </p>

          {passwordMessage && (
            <p className="mt-3 text-sm text-green-600">{passwordMessage}</p>
          )}
          {passwordError && (
            <p className="mt-3 text-sm text-red-500">{passwordError}</p>
          )}

          <button
            type="button"
            onClick={handleSendPasswordResetEmail}
            disabled={sendingResetEmail}
            className="mt-4 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {sendingResetEmail ? "Sending..." : "Send Password Reset Email"}
          </button>
        </div>

        <div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-5">
          <h2 className="text-lg font-semibold text-red-700">Delete Account</h2>
          <p className="mt-1 text-sm text-red-600">
            This will permanently delete your account. This action cannot be
            undone.
          </p>

          {deleteError && (
            <p className="mt-3 text-sm text-red-500">{deleteError}</p>
          )}

          <button
            type="button"
            onClick={handleDeleteAccount}
            disabled={deletingAccount}
            className="mt-4 rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
          >
            {deletingAccount ? "Deleting..." : "Delete Account"}
          </button>
        </div>
      </div>
    </div>
  );
}
