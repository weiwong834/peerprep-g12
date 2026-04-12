import { NavLink, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  FiUser,
  FiLogOut,
  FiMenu,
  FiChevronLeft,
} from "react-icons/fi";
import { MdOutlineHome, MdOutlineCode, MdOutlineLock } from "react-icons/md";
import { getUserInfo } from "../services/userService";

type UserProfile = {
  id: string;
  username: string;
  email: string;
  isAdmin: boolean;
};

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { to: "/home", label: "Home", icon: MdOutlineHome },
  { to: "/collab", label: "Collab", icon: MdOutlineCode },
  { to: "/profile", label: "Profile", icon: FiUser },
  { to: "/admin", label: "Admin", icon: MdOutlineLock, adminOnly: true },
];

export default function Navbar() {
  const navigate = useNavigate();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const activeStyle = "bg-indigo-600 text-white";
  const inactiveStyle = "text-slate-700 hover:bg-slate-200";

  useEffect(() => {
    async function loadUser() {
      try {
        const data = await getUserInfo();
        setUser(data);
      } catch {
        setUser(null);
      }
    }

    loadUser();
  }, []);

  function handleLogout() {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("isAdmin");
    navigate("/login");
  }
  return (
    <>
      <aside
        className={`h-screen shrink-0 border-r border-slate-200 bg-white shadow-sm transition-all duration-300 ${
          collapsed ? "w-20 p-3" : "w-60 p-6"
        } flex flex-col`}
      >
        <div
          className={`mb-8 flex items-center ${
            collapsed ? "justify-center" : "justify-between"
          }`}
        >
          {!collapsed && (
            <h1 className="text-xl font-bold text-indigo-600">PeerPrep</h1>
          )}

          <button
            type="button"
            onClick={() => setCollapsed((prev) => !prev)}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-800"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <FiMenu className="h-5 w-5" />
            ) : (
              <FiChevronLeft className="h-5 w-5" />
            )}
          </button>
        </div>

        <nav className="flex flex-col gap-3">
          {NAV_ITEMS.filter((item) => !item.adminOnly || user?.isAdmin).map(
            (item) => {
              const Icon = item.icon;

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  title={collapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    `rounded-xl transition ${
                      collapsed
                        ? "flex items-center justify-center px-3 py-3"
                        : "flex items-center gap-3 px-4 py-3"
                    } ${isActive ? activeStyle : inactiveStyle}`
                  }
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </NavLink>
              );
            },
          )}
        </nav>

        <div className="mt-auto pt-6">
          <button
            onClick={() => setShowLogoutConfirm(true)}
            title={collapsed ? "Logout" : undefined}
            className={`w-full rounded-xl border border-slate-300 text-slate-700 transition hover:bg-red-700 hover:text-white ${
              collapsed
                ? "flex items-center justify-center px-3 py-3"
                : "flex items-center gap-3 px-4 py-3"
            }`}
          >
            <FiLogOut className="h-5 w-5 shrink-0" />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl border border-slate-200">
            <h2 className="text-lg font-semibold text-slate-800">Log out?</h2>

            <p className="mt-2 text-sm text-slate-600">
              Are you sure you want to log out of PeerPrep?
            </p>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="w-full rounded-xl border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="w-full rounded-xl bg-red-600 px-4 py-2 text-white hover:bg-red-700"
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
