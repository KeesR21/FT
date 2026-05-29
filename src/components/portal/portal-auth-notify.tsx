"use client";

import clsx from "clsx";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import { sanitizeDisplayMessage } from "@/lib/api-error";

export type PortalAuthToastVariant = "success" | "error" | "warning" | "info";

export type PortalAuthToastOptions = {
  /** Milliseconds before auto-dismiss. `0` keeps the toast until closed. Default: 4500 (errors 6500). */
  duration?: number;
  /** HTTP status used when sanitizing backend messages. */
  status?: number;
};

type ToastItem = {
  id: string;
  variant: PortalAuthToastVariant;
  message: string;
  duration: number;
};

export type PortalAuthNotify = {
  show: (variant: PortalAuthToastVariant, message: string, options?: PortalAuthToastOptions) => void;
  success: (message: string, options?: PortalAuthToastOptions) => void;
  error: (message: string, options?: PortalAuthToastOptions) => void;
  warning: (message: string, options?: PortalAuthToastOptions) => void;
  info: (message: string, options?: PortalAuthToastOptions) => void;
  dismiss: (id: string) => void;
};

const PortalAuthNotifyContext = createContext<PortalAuthNotify | null>(null);

export function usePortalAuthNotify(): PortalAuthNotify {
  const ctx = useContext(PortalAuthNotifyContext);
  if (!ctx) {
    throw new Error("usePortalAuthNotify must be used within PortalAuthNotifyProvider");
  }
  return ctx;
}

/** Inline spinner for primary auth buttons while `busy`. */
export function PortalAuthButtonSpinner({ className }: { className?: string }) {
  return <span className={clsx("portal-auth-btn-spinner", className)} aria-hidden />;
}

const TOAST_ICONS: Record<PortalAuthToastVariant, string> = {
  success: "✓",
  error: "✕",
  warning: "!",
  info: "i"
};

function ToastRow({
  toast,
  onDismiss
}: {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}) {
  useEffect(() => {
    if (toast.duration <= 0) return undefined;
    const timer = window.setTimeout(() => onDismiss(toast.id), toast.duration);
    return () => window.clearTimeout(timer);
  }, [toast.duration, toast.id, onDismiss]);

  return (
    <div
      className={clsx("portal-auth-snackbar", `portal-auth-snackbar--${toast.variant}`)}
      role={toast.variant === "error" ? "alert" : "status"}
      aria-live={toast.variant === "error" ? "assertive" : "polite"}
    >
      <span className="portal-auth-snackbar__icon" aria-hidden>
        {TOAST_ICONS[toast.variant]}
      </span>
      <p className="portal-auth-snackbar__text">{toast.message}</p>
      <button
        type="button"
        className="portal-auth-snackbar__close"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
      >
        ×
      </button>
    </div>
  );
}

export function PortalAuthNotifyProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const regionId = useId();

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (variant: PortalAuthToastVariant, message: string, options?: PortalAuthToastOptions) => {
      const safe = sanitizeDisplayMessage(message, options?.status ?? 0);
      if (!safe) return;
      const defaultDur = variant === "error" ? 6500 : 4500;
      const duration = options?.duration ?? defaultDur;
      const id = `pat-${Date.now()}-${seq.current++}`;
      setToasts((prev) => {
        const next = [...prev, { id, variant, message: safe, duration }];
        return next.slice(-5);
      });
    },
    []
  );

  const api = useMemo<PortalAuthNotify>(
    () => ({
      show,
      success: (m, o) => show("success", m, o),
      error: (m, o) => show("error", m, o),
      warning: (m, o) => show("warning", m, o),
      info: (m, o) => show("info", m, o),
      dismiss
    }),
    [dismiss, show]
  );

  return (
    <PortalAuthNotifyContext.Provider value={api}>
      {children}
      <div
        id={regionId}
        className="portal-auth-snackbar-host"
        aria-label="Notifications"
      >
        {toasts.map((t) => (
          <ToastRow key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </PortalAuthNotifyContext.Provider>
  );
}
