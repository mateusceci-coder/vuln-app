import { NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, Ticket, ShieldCheck, LogOut } from "lucide-react";
import Aurora from "./Aurora";
import Logo from "./Logo";
import Avatar from "./ui/Avatar";
import { PapelBadge } from "./ui/Badge";
import { useAuth } from "../auth/AuthContext";
import styles from "./Sidebar.module.css";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/chamados", label: "Chamados", icon: Ticket },
];

export default function Sidebar({ open, onClose }) {
  const { usuario, papel, logout } = useAuth();
  const navigate = useNavigate();

  const sair = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const linkCls = ({ isActive }) =>
    [styles.link, isActive && styles.active].filter(Boolean).join(" ");

  return (
    <aside className={[styles.sidebar, open && styles.open].filter(Boolean).join(" ")}>
      <Aurora variant="ambient" />
      <div className={styles.inner}>
        <NavLink to="/dashboard" className={styles.brand} onClick={onClose}>
          <Logo size={32} />
          <span className={styles.word}>
            Aurora<span className={styles.wordThin}>Chamados</span>
          </span>
        </NavLink>

        <nav className={styles.nav} onClick={onClose}>
          <span className={styles.navLabel}>Navegação</span>
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={linkCls}>
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
          {papel === "admin" && (
            <NavLink to="/admin" className={linkCls}>
              <ShieldCheck size={18} />
              Administração
            </NavLink>
          )}
        </nav>

        <div className={styles.footer}>
          <NavLink to="/perfil" className={styles.user} onClick={onClose}>
            <Avatar nome={usuario?.nome} size={38} />
            <span className={styles.userText}>
              <span className={styles.userName}>{usuario?.nome || "—"}</span>
              <PapelBadge papel={papel} />
            </span>
          </NavLink>
          <button className={styles.logout} onClick={sair} title="Sair" aria-label="Sair">
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </aside>
  );
}
