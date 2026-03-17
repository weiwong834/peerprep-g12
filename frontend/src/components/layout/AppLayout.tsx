import { Outlet } from "react-router-dom";
import Navbar from "../Navbar";

export default function AppLayout() {
  return (
    <div className="flex h-screen bg-slate-100">
      {/* Navbar */}
      <Navbar />

      {/* Main content */}
      <main className="flex-1 p-8 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
