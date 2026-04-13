import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { signupUser, checkUniqueUsername } from "../services/userService";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(
    null,
  );
  const [usernameChecking, setUsernameChecking] = useState(false);

  const [submitError, setSubmitError] = useState("");
  const [emailSubmitError, setEmailSubmitError] = useState("");
  const [usernameSubmitError, setUsernameSubmitError] = useState("");
  const [signupSuccess, setSignupSuccess] = useState(false);

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
  const canEnterPassword = usernameFormatValid && usernameAvailable === true;

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
    usernameFormatValid &&
    usernameAvailable === true &&
    passwordValid &&
    passwordsMatch;

  useEffect(() => {
    setSubmitError("");
    setEmailSubmitError("");
    setUsernameSubmitError("");
    setUsernameAvailable(null);
  }, [email]);

  useEffect(() => {
    setUsernameSubmitError("");
  }, [username]);

  // ---------------- LIVE USERNAME CHECK ----------------
  useEffect(() => {
    let cancelled = false;

    if (!usernameFormatValid || !username.trim()) {
      setUsernameAvailable(null);
      setUsernameChecking(false);
      return;
    }

    setUsernameChecking(true);

    const timeoutId = setTimeout(async () => {
      try {
        const result = await checkUniqueUsername(username);

        if (!cancelled) {
          setUsernameAvailable(result.available);
        }
      } catch {
        if (!cancelled) {
          setUsernameAvailable(null);
        }
      } finally {
        if (!cancelled) {
          setUsernameChecking(false);
        }
      }
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [username, usernameFormatValid]);

  // ---------------- ACTIONS ----------------
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setSubmitError("");
    setEmailSubmitError("");
    setUsernameSubmitError("");

    if (!canSubmit) {
      setSubmitError("Please complete all required fields correctly");
      return;
    }

    try {
      await signupUser(username, email, password);
      setSignupSuccess(true);
    } catch (err: any) {
      if (err?.code === "DUPLICATE_EMAIL") {
        setEmailSubmitError("This email is already registered.");
      } else if (err?.code === "DUPLICATE_USERNAME") {
        setUsernameSubmitError("Username already taken.");
      } else {
        setSubmitError(err?.message || "Signup failed. Please try again.");
      }
    }
  }

  function renderStatus(valid: boolean | null, checking = false) {
    if (checking) {
      return <span className="text-slate-500">Checking...</span>;
    }

    if (valid === true) {
      return <span className="text-green-600">Valid</span>;
    }

    if (valid === false) {
      return <span className="text-red-500">Not available</span>;
    }

    return null;
  }

  function requirementItem(label: string, met: boolean) {
    return (
      <li className={met ? "text-green-600" : "text-slate-500"}>
        {"•"} {label}
      </li>
    );
  }

  if (signupSuccess) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-lg text-center">
          <h1 className="text-2xl font-bold text-slate-800">
            Check your email
          </h1>

          <p className="mt-4 text-sm text-slate-600">
            We’ve sent a verification link to{" "}
            <span className="font-medium">{email}</span>.
          </p>

          <p className="mt-2 text-sm text-slate-500">
            Please verify your email before logging in to PeerPrep.
          </p>

          <p className="mt-2 text-sm text-slate-500">
            If you do not see the email, check your spam or junk folder.
          </p>

          <div className="mt-6">
            <Link
              to="/login"
              className="inline-block rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700"
            >
              Back to Login
            </Link>
          </div>
        </div>
      </div>
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
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            />
            <div className="mt-1 min-h-5 text-sm">
              {!email && null}
              {email && !emailFormatValid && (
                <span className="text-red-500">Invalid email format</span>
              )}
              {emailSubmitError && (
                <div className="text-red-500">{emailSubmitError}</div>
              )}
            </div>
          </div>
          {/* Username */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Username
            </label>
            <input
              type="text"
              placeholder="Choose a username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:bg-slate-100"
            />
            <div className="mt-1 min-h-5 text-sm">
              {!username && (
                <div className="text-slate-500 space-y-1">
                  <div>
                    Only lowercase letters, numbers, '-' and '_' are accepted
                  </div>
                  <div>3–20 characters, no spaces</div>
                </div>
              )}

              {username && usernameError && (
                <span className="text-red-500">{usernameError}</span>
              )}

              {username &&
                usernameFormatValid &&
                renderStatus(usernameAvailable, usernameChecking)}

              {usernameSubmitError && (
                <div className="text-red-500">{usernameSubmitError}</div>
              )}
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Password
            </label>
            <input
              type="password"
              placeholder="Create a password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={!canEnterPassword}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:bg-slate-100"
            />
            {canEnterPassword ? (
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
            ) : null }
            
          </div>

          {/* Confirm Password */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Retype Password
            </label>
            <input
              type="password"
              placeholder="Retype your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={!canEnterPassword}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:bg-slate-100"
            />

            <div className="mt-1 min-h-5 text-sm">
              {confirmPassword.length > 0 && passwordsMatch && (
                <span className="text-green-600">Passwords match</span>
              )}
              {confirmPassword.length > 0 && !passwordsMatch && (
                <span className="text-red-500">Passwords do not match</span>
              )}
            </div>
          </div>

          {submitError && <p className="text-sm text-red-500">{submitError}</p>}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full rounded-lg bg-indigo-600 py-2 font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            Sign Up
          </button>
        </form>

        <div className="mt-5 text-center text-sm text-slate-600">
          Already have an account?{" "}
          <Link to="/login" className="text-indigo-600 hover:underline">
            Log in
          </Link>
        </div>
      </div>
    </div>
  );
}
