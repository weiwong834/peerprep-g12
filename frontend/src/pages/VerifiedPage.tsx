import { Link, useLocation } from "react-router-dom";

export default function VerifiedPage() {
  const location = useLocation();

  const hash = location.hash.startsWith("#")
    ? location.hash.substring(1)
    : location.hash;

  const params = new URLSearchParams(hash);

  const error = params.get("error");
  const errorCode = params.get("error_code");

  const isExpired = errorCode === "otp_expired";

  console.log("Verification error:", { error, errorCode });

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-lg text-center">

        <h1 className="text-2xl font-bold text-slate-800">
          {isExpired ? "Verification link expired" : "Email confirmed"}
        </h1>

        {isExpired ? (
          <>
            <p className="mt-4 text-sm text-slate-600">
              Your verification link has expired or is invalid.
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Please request a new verification email by signing up again.
            </p>
          </>
        ) : (
          <>
            <p className="mt-4 text-sm text-slate-600">
              Your email has been verified successfully.
            </p>
            <p className="mt-2 text-sm text-slate-500">
              You can now log in to PeerPrep with your credentials.
            </p>
          </>
        )}

        <div className="mt-6">
          <Link
            to="/login"
            className="inline-block rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700"
          >
            Go to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
