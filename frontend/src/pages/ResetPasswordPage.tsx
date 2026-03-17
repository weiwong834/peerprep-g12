import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

export default function ResetPasswordPage() {
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const passwordChecks = useMemo(
    () => ({
      minLength: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /\d/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    }),
    [password],
  );

  const passwordValid =
    passwordChecks.minLength &&
    passwordChecks.uppercase &&
    passwordChecks.lowercase &&
    passwordChecks.number &&
    passwordChecks.special;

  const passwordsMatch =
    confirmPassword.length > 0 && password === confirmPassword;

  function requirementItem(label: string, met: boolean) {
    return (
      <li className={met ? "text-green-600" : "text-slate-500"}>
        {met ? "✓" : "•"} {label}
      </li>
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!(passwordValid && passwordsMatch)) return;

    setSubmitted(true);

    setTimeout(() => {
      navigate("/login");
    }, 1200);
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
        <h1 className="text-2xl font-bold text-slate-800 text-center">
          Reset Password
        </h1>
        <p className="mt-2 text-center text-sm text-slate-500">
          Enter your new password
        </p>

        {!submitted ? (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                New Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </div>

            <ul className="space-y-1 text-sm">
              {requirementItem(
                "At least 8 characters",
                passwordChecks.minLength,
              )}
              {requirementItem(
                "Contains an uppercase letter",
                passwordChecks.uppercase,
              )}
              {requirementItem(
                "Contains a lowercase letter",
                passwordChecks.lowercase,
              )}
              {requirementItem("Contains a number", passwordChecks.number)}
              {requirementItem(
                "Contains a special character",
                passwordChecks.special,
              )}
            </ul>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
              <div className="mt-1 min-h-5 text-sm">
                {confirmPassword.length > 0 && passwordsMatch && (
                  <span className="text-green-600">✓ Passwords match</span>
                )}
                {confirmPassword.length > 0 && !passwordsMatch && (
                  <span className="text-red-500">✗ Passwords do not match</span>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={!(passwordValid && passwordsMatch)}
              className="w-full rounded-lg bg-blue-600 py-2 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Reset Password
            </button>
          </form>
        ) : (
          <div className="mt-6 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            Password reset successful. Redirecting to login...
          </div>
        )}

        <div className="mt-5 text-center text-sm text-slate-600">
          <Link to="/login" className="text-blue-600 hover:underline">
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}
