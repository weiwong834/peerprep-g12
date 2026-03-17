import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signupUser } from "../services/userService";

export default function SignupPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [emailAvailable, setEmailAvailable] = useState<boolean | null>(null);
  const [emailChecking, setEmailChecking] = useState(false);

  const [codeSent, setCodeSent] = useState(false);
  const [codeVerified, setCodeVerified] = useState(false);
  const [codeError, setCodeError] = useState("");

  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(
    null,
  );
  const [usernameChecking, setUsernameChecking] = useState(false);

  const [submitError, setSubmitError] = useState("");

  // ---------------- MOCK API ----------------
  async function mockCheckEmailAvailability(inputEmail: string) {
    await new Promise((resolve) => setTimeout(resolve, 400));

    if (inputEmail.toLowerCase() === "admin@gmail.com") {
      return { available: false };
    }

    return { available: true };
  }

  async function mockSendVerificationCode() {
    await new Promise((resolve) => setTimeout(resolve, 400));
    return { success: true };
  }

  async function mockVerifyCode(inputCode: string) {
    await new Promise((resolve) => setTimeout(resolve, 400));

    if (inputCode === "123456") {
      return { valid: true };
    }

    return { valid: false };
  }

  async function mockCheckUsernameAvailability(inputUsername: string) {
    await new Promise((resolve) => setTimeout(resolve, 400));

    if (inputUsername.toLowerCase() === "admin") {
      return { available: false };
    }

    return { available: true };
  }

  // ---------------- VALIDATION ----------------
  const emailFormatValid = useMemo(() => {
    if (!email) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }, [email]);

  function getUsernameError(name: string): string | null {
    if (!name) return "Please enter a username.";

    if (name.length < 3) {
      return "Username must be at least 3 characters.";
    }

    if (name.length > 20) {
      return "Username must be at most 20 characters.";
    }

    if (/\s/.test(name)) {
      return "Username cannot contain spaces.";
    }

    if (name !== name.toLowerCase()) {
      return "Only lowercase letters allowed.";
    }

    if (!/^[a-z0-9_-]+$/.test(name)) {
      return "Only letters, numbers, '-' and '_' allowed.";
    }

    return null;
  }

  const usernameError = getUsernameError(username);
  const usernameFormatValid = usernameError === null;

  const passwordChecks = useMemo(
    () => ({
      minLength: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /\d/.test(password),
      special: /[!@#$%^&*()]/.test(password),
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

  const canSubmit =
    emailFormatValid &&
    emailAvailable === true &&
    codeVerified &&
    usernameFormatValid &&
    usernameAvailable === true &&
    passwordValid &&
    passwordsMatch;

  // ---------------- LIVE EMAIL CHECK ----------------
  useEffect(() => {
    let cancelled = false;

    async function checkEmail() {
      // reset dependent fields if email changes
      setCodeSent(false);
      setCodeVerified(false);
      setVerificationCode("");
      setCodeError("");
      setSubmitError("");
      setUsernameAvailable(null);

      if (!email || !emailFormatValid) {
        setEmailAvailable(null);
        setEmailChecking(false);
        return;
      }

      setEmailChecking(true);
      const result = await mockCheckEmailAvailability(email);

      if (!cancelled) {
        setEmailAvailable(result.available);
        setEmailChecking(false);
      }
    }

    checkEmail();

    return () => {
      cancelled = true;
    };
  }, [email, emailFormatValid]);

  // ---------------- LIVE USERNAME CHECK ----------------
  useEffect(() => {
    let cancelled = false;

    async function checkUsername() {
      setSubmitError("");

      if (!codeVerified || !usernameFormatValid) {
        setUsernameAvailable(null);
        setUsernameChecking(false);
        return;
      }

      setUsernameChecking(true);
      const result = await mockCheckUsernameAvailability(username);

      if (!cancelled) {
        setUsernameAvailable(result.available);
        setUsernameChecking(false);
      }
    }

    checkUsername();

    return () => {
      cancelled = true;
    };
  }, [username, codeVerified, usernameFormatValid]);

  // ---------------- ACTIONS ----------------
  async function handleGetCode() {
    if (!(emailFormatValid && emailAvailable)) return;

    const result = await mockSendVerificationCode();
    if (result.success) {
      setCodeSent(true);
      setCodeError("");
    }
  }

  async function handleVerifyCode() {
    setCodeError("");
    setSubmitError("");

    if (!verificationCode.trim()) {
      setCodeError("Please enter the verification code.");
      return;
    }

    const result = await mockVerifyCode(verificationCode);

    if (!result.valid) {
      setCodeVerified(false);
      setCodeError("Verification code is incorrect.");
      return;
    }

    setCodeVerified(true);
    setCodeError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError("");

    if (!canSubmit) {
      setSubmitError("Please complete all required fields correctly");
      return;
    }

    try {
      await signupUser(username, email, password);

      navigate("/login");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Signup failed. Please try again.";
      setSubmitError(message);
    }
  }

  function renderStatus(valid: boolean | null, checking = false) {
    if (checking) {
      return <span className="text-slate-500">Checking...</span>;
    }

    if (valid === true) {
      return <span className="text-green-600">✓ Valid</span>;
    }

    if (valid === false) {
      return <span className="text-red-500">✗ Not available</span>;
    }

    return null;
  }

  function requirementItem(label: string, met: boolean) {
    return (
      <li className={met ? "text-green-600" : "text-slate-500"}>
        {met ? "✓" : "•"} {label}
      </li>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-lg">
        <h1 className="text-2xl font-bold text-slate-800 text-center">
          Create your PeerPrep account
        </h1>
        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          {/* Email */}
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
            <div className="mt-1 min-h-5 text-sm">
              {!email && null}
              {email && !emailFormatValid && (
                <span className="text-red-500">✗ Invalid email format</span>
              )}
              {emailFormatValid && renderStatus(emailAvailable, emailChecking)}
              {emailAvailable === true && (
                <span className="ml-2 text-green-600">Email is available</span>
              )}
            </div>
          </div>

          {/* Verification Code */}
          <div
            className={
              !(emailFormatValid && emailAvailable) ? "opacity-40" : ""
            }
          >
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Verification Code
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Enter verification code"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                disabled={!(emailFormatValid && emailAvailable)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:cursor-not-allowed disabled:bg-slate-100"
              />
              <button
                type="button"
                onClick={handleGetCode}
                disabled={!(emailFormatValid && emailAvailable)}
                className="whitespace-nowrap rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Get Code
              </button>
              <button
                type="button"
                onClick={handleVerifyCode}
                disabled={!(emailFormatValid && emailAvailable) || !codeSent}
                className="whitespace-nowrap rounded-lg bg-slate-700 px-4 py-2 text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Verify
              </button>
            </div>

            <div className="mt-1 min-h-5 text-sm">
              {codeSent && !codeVerified && !codeError && (
                <span className="text-slate-500">
                  Code sent. Use <strong>123456</strong> for demo.
                </span>
              )}
              {codeVerified && (
                <span className="text-green-600">✓ Email verified</span>
              )}
              {codeError && <span className="text-red-500">{codeError}</span>}
            </div>
          </div>

          {/* Username */}
          <div className={!codeVerified ? "opacity-40" : ""}>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Username
            </label>
            <input
              type="text"
              placeholder="Choose a username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={!codeVerified}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:cursor-not-allowed disabled:bg-slate-100"
            />
            <div className="mt-1 min-h-5 text-sm">
              {!codeVerified && null}

              {/* show grey requirements when empty */}
              {codeVerified && !username && (
                <div className="text-slate-500 space-y-1">
                  <div>
                    Only lowercase letters, numbers, '-' and '_' are accepted
                  </div>
                  <div>3-20 characters, no spaces</div>
                </div>
              )}

              {codeVerified && username && usernameError && (
                <span className="text-red-500">✗ {usernameError}</span>
              )}

              {codeVerified &&
                username &&
                usernameFormatValid &&
                renderStatus(usernameAvailable, usernameChecking)}

              {codeVerified &&
                username &&
                usernameFormatValid &&
                usernameAvailable === true && (
                  <span className="ml-2 text-green-600">
                    Username is available
                  </span>
                )}
            </div>
          </div>

          {/* Password */}
          <div className={!codeVerified ? "opacity-40" : ""}>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Password
            </label>
            <input
              type="password"
              placeholder="Create a password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={!codeVerified}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:cursor-not-allowed disabled:bg-slate-100"
            />

            <ul className="mt-2 space-y-1 text-sm">
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
                "Contains a special character !@#$%^&*()",
                passwordChecks.special,
              )}
            </ul>
          </div>

          {/* Confirm Password */}
          <div className={!codeVerified ? "opacity-40" : ""}>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Retype Password
            </label>
            <input
              type="password"
              placeholder="Retype your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={!codeVerified}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:cursor-not-allowed disabled:bg-slate-100"
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

          {submitError && <p className="text-sm text-red-500">{submitError}</p>}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full rounded-lg bg-blue-600 py-2 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            Sign Up
          </button>
        </form>

        <div className="mt-5 text-center text-sm text-slate-600">
          Already have an account?{" "}
          <Link to="/login" className="text-blue-600 hover:underline">
            Log in
          </Link>
        </div>
      </div>
    </div>
  );
}
