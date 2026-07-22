import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import styles from "./AppShell.module.css";

export default function AppShell() {
  const [navOpen, setNavOpen] = useState(false);
  const location = useLocation();

  return (
    <div className={styles.shell}>
      <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />
      {navOpen && <div className={styles.scrim} onClick={() => setNavOpen(false)} />}
      <div className={styles.main}>
        <Topbar onMenu={() => setNavOpen(true)} />
        <main className={styles.content}>
          <div key={location.pathname} className={`${styles.inner} rise`}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
