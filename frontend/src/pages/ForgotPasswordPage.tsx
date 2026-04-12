import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { requestResetPassword } from "../services/userService";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);

  const emailFormatValid = useMemo(() => {
    if (!email) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }, [email]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!emailFormatValid) {
      setError("Please enter a valid email address.");
      return;
    }

    try {
      setSending(true);
      await requestResetPassword(email);
      setSubmitted(true);
    } catch (err: any) {
      setError(err?.message || "Failed to send reset email.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
        <h1 className="text-2xl font-bold text-slate-800 text-center">
          Forgot Password
        </h1>

        {!submitted ? (
          <>
            <p className="mt-2 text-center text-sm text-slate-500">
              Enter your email and we’ll send you a password reset link.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Email
                </label>
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError("");
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                />
                <div className="mt-1 min-h-5 text-sm">
                  {email && !emailFormatValid && (
                    <span className="text-red-500">✗ Invalid email format</span>
                  )}
                </div>
              </div>

              {error && <p className="text-sm text-red-500">{error}</p>}

              <button
                type="submit"
                disabled={sending}
                className="w-full rounded-lg bg-indigo-600 py-2 font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {sending ? "Sending..." : "Send Reset Link"}
              </button>
            </form>
          </>
        ) : (
          <div className="mt-6 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            A password reset link has been sent to <strong>{email}</strong>.
            Please check your inbox and spam folder.
          </div>
        )}

        <div className="mt-5 text-center text-sm text-slate-600">
          <Link to="/login" className="text-indigo-600 hover:underline">
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}
