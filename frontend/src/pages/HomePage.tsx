export default function HomePage() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-4">Welcome to PeerPrep</h1>

      <p className="text-slate-600 mb-6">Hi here's the skeleton of the app.</p>

      <div className="bg-white p-6 rounded-xl shadow-sm">
        <h2 className="text-lg font-semibold mb-2">Getting Started</h2>

        <ul className="list-disc ml-5 text-slate-600 space-y-1">
          <li>what's implemented</li>
          <li>login and sign up</li>
          <li>for sign up verification (mock): user 123456</li>
          <li>
            ^^ i made it such that user can only enter the next field if
            previous is verified.
          </li>
          <li>^ ++ live checking for format validity (not uniqueness yet)</li>
          <li>
            can try to "find a match" in collab page to navigate to collab room
          </li>
          <li>
            what's left for userservice: creation + integration of
            email/username uniqueness, update pw, verify otp endpoints
          </li>
          <li>come back later for updated ui!</li>
        </ul>
      </div>
    </div>
  );
}
