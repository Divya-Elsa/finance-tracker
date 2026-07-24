import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <nav className="nav">
        <span className="brand">Finance Tracker</span>
        <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
          Dashboard
        </NavLink>
        <NavLink to="/transactions" className={({ isActive }) => (isActive ? "active" : "")}>
          Transactions
        </NavLink>
        <NavLink to="/budgets" className={({ isActive }) => (isActive ? "active" : "")}>
          Budgets
        </NavLink>
        <NavLink to="/reports" className={({ isActive }) => (isActive ? "active" : "")}>
          Reports
        </NavLink>
        <span style={{ color: "var(--text-muted)", fontSize: 13 }}>{user?.email}</span>
        <button className="secondary" onClick={logout}>
          Log out
        </button>
      </nav>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
