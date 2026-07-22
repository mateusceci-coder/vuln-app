import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";
import styles from "./Toast.module.css";

const ToastCtx = createContext(null);

const ICONS = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info,
};

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);

  const remove = useCallback((id) => {
    setItems((list) => list.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (message, type = "info") => {
      const id = Math.random().toString(36).slice(2);
      setItems((list) => [...list, { id, message, type }]);
      setTimeout(() => remove(id), 4500);
    },
    [remove]
  );

  const api = useMemo(
    () => ({
      push,
      success: (m) => push(m, "success"),
      error: (m) => push(m, "error"),
      info: (m) => push(m, "info"),
    }),
    [push]
  );

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className={styles.stack} role="region" aria-label="Notificações">
        {items.map((t) => {
          const Icon = ICONS[t.type] || Info;
          return (
            <div key={t.id} className={`${styles.toast} ${styles[t.type]}`} role="status">
              <Icon size={18} className={styles.icon} />
              <span className={styles.msg}>{t.message}</span>
              <button className={styles.close} onClick={() => remove(t.id)} aria-label="Fechar">
                <X size={15} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast precisa estar dentro de <ToastProvider>");
  return ctx;
}
