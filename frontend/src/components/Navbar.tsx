import { NavLink, useNavigate } from "react-router-dom";

export default function Navbar() {
  const navigate = useNavigate();

  const linkStyle = "block px-4 py-2 rounded-lg transition";
  const activeStyle = "bg-blue-600 text-white";
  const inactiveStyle = "text-slate-700 hover:bg-slate-200";

  function handleLogout() {
    localStorage.removeItem("accessToken");
    navigate("/login");
  }
  return (
    <aside className="w-60 bg-white shadow-md p-6 flex flex-col">
      <div className="mb-8 flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-blue-600">PeerPrep</h1>

        <button
          onClick={handleLogout}
          className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
        >
          Logout
        </button>
      </div>

      <nav className="flex flex-col gap-3">
        <NavLink
          to="/home"
          className={({ isActive }) =>
            `${linkStyle} ${isActive ? activeStyle : inactiveStyle}`
          }
        >
          Home
        </NavLink>

        <NavLink
          to="/collab"
          className={({ isActive }) =>
            `${linkStyle} ${isActive ? activeStyle : inactiveStyle}`
          }
        >
          Collab
        </NavLink>

        <NavLink
          to="/profile"
          className={({ isActive }) =>
            `${linkStyle} ${isActive ? activeStyle : inactiveStyle}`
          }
        >
          Profile
        </NavLink>
      </nav>
    </aside>
  );
}
