import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FiEye, FiEyeOff } from "react-icons/fi";
import { loginUser, getUserInfo } from "../services/userService";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();

    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }

    try {
      await loginUser(email, password);
      const user = await getUserInfo();
      localStorage.setItem("isAdmin", String(user.isAdmin));
      navigate("/home");
    } catch (err: any) {
      if (err?.code === "INVALID_CREDENTIALS") {
        setError("");
      } else {
        setError(err?.message || "Login failed. Please try again.");
      }
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white/95 p-8 shadow-xl backdrop-blur">
        <h1 className="text-2xl font-bold text-slate-800 text-center">
          PeerPrep
        </h1>
        <p className="mt-2 text-center text-sm text-slate-500">Login</p>

        <form onSubmit={handleLogin} className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              type="text"
              inputMode="email"
              autoComplete="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-10 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
              />

              <button
                type="button"
                onMouseDown={() => setShowPassword(true)}
                onMouseUp={() => setShowPassword(false)}
                onMouseLeave={() => setShowPassword(false)}
                onTouchStart={() => setShowPassword(true)}
                onTouchEnd={() => setShowPassword(false)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-indigo-600 transition"
                aria-label="Hold to show password"
              >
                {showPassword ? (
                  <FiEye className="w-5 h-5" />
                ) : (
                  <FiEyeOff className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600"
            >
              <div className="whitespace-pre-wrap">{error}</div>
              <button
                type="button"
                aria-label="Dismiss error"
                onClick={() => setError("")}
                className="ml-2 rounded-md px-2 py-1 text-sm text-red-600 hover:bg-red-100"
              >
                ×
              </button>
            </div>
          )}

          <button
            type="submit"
            className="w-full rounded-xl bg-indigo-600 py-2.5 font-medium text-white transition hover:bg-indigo-700 shadow-sm hover:shadow"
          >
            Log In
          </button>
        </form>

        <div className="mt-4 flex items-center justify-between text-sm">
          <Link
            to="/forgot-password"
            className="text-indigo-600 hover:underline"
          >
            Forgot password?
          </Link>

          <Link to="/signup" className="text-indigo-600 hover:underline">
            Sign up
          </Link>
        </div>
      </div>
    </div>
  );
}
