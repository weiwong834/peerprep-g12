import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

export default function ForgotPasswordPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");

  const [emailValid, setEmailValid] = useState<boolean | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);

  const [error, setError] = useState("");
  const [otpError, setOtpError] = useState("");

  function validateEmail(input: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
  }

  function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setOtpError("");
    setOtpVerified(false);

    if (!validateEmail(email)) {
      setEmailValid(false);
      setError("Please enter a valid email address.");
      return;
    }

    setEmailValid(true);
    setOtpSent(true);
  }

  function handleVerifyOtp() {
    setOtpError("");

    if (!otp.trim()) {
      setOtpError("Please enter the OTP.");
      return;
    }

    // mock OTP
    if (otp.trim() !== "654321") {
      setOtpVerified(false);
      setOtpError("Incorrect OTP.");
      return;
    }

    setOtpVerified(true);

    // move to reset password page
    navigate("/reset-password");
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
        <h1 className="text-2xl font-bold text-slate-800 text-center">
          Forgot Password
        </h1>
        <p className="mt-2 text-center text-sm text-slate-500">
          Enter your email to receive a one-time password
        </p>

        <form onSubmit={handleSendOtp} className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          {emailValid && !error && (
            <p className="text-sm text-green-600">✓ Valid email format</p>
          )}

          <button
            type="submit"
            className="w-full rounded-lg bg-blue-600 py-2 font-medium text-white transition hover:bg-blue-700"
          >
            Send OTP
          </button>
        </form>

        {otpSent && (
          <div className="mt-6 space-y-4 rounded-lg border border-slate-200 p-4">
            <p className="text-sm text-slate-600">
              OTP sent. For demo, use <strong>654321</strong>.
            </p>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Enter OTP
              </label>
              <input
                type="text"
                placeholder="6-digit OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </div>

            {otpError && <p className="text-sm text-red-500">{otpError}</p>}

            <button
              type="button"
              onClick={handleVerifyOtp}
              className="w-full rounded-lg bg-slate-800 py-2 font-medium text-white transition hover:bg-slate-900"
            >
              Verify OTP
            </button>
          </div>
        )}

        <div className="mt-5 text-center text-sm text-slate-600">
          Remembered your password?{" "}
          <Link to="/login" className="text-blue-600 hover:underline">
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}
