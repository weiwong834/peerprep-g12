import { Link } from "react-router-dom";

export default function VerifiedPage() {
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-lg text-center">
        <h1 className="text-2xl font-bold text-slate-800">Email confirmed</h1>
        <p className="mt-4 text-sm text-slate-600">
          Your email has been verified successfully.
        </p>
        <p className="mt-2 text-sm text-slate-500">
          You can now log in to PeerPrep with your credentials.
        </p>

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
