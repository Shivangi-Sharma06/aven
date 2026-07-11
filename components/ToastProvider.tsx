"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import styles from "./ToastProvider.module.css";

type ToastKind = "success" | "error" | "info";
type Toast = { id: number; kind: ToastKind; message: string };

const ToastContext = createContext<(kind: ToastKind, message: string) => void>(() => undefined);

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      timers.current.forEach((timer) => window.clearTimeout(timer));
      timers.current = [];
    };
  }, []);

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = Number.parseInt(crypto.randomUUID().replaceAll("-", "").slice(0, 12), 16);
    setToasts((current) => [...current, { id, kind, message }]);
    const timer = window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
      timers.current = timers.current.filter((item) => item !== timer);
    }, 4000);
    timers.current.push(timer);
  }, []);

  const value = useMemo(() => push, [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className={styles.viewport}>
        {toasts.map((toast) => (
          <div className={`${styles.toast} ${styles[toast.kind]}`} key={toast.id}>
            <span>{toast.message}</span>
            <button
              aria-label="Close notification"
              className={styles.close}
              onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}
              type="button"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
