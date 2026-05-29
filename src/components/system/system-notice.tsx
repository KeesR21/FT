import clsx from "clsx";
import type { ReactNode } from "react";
import { sanitizeDisplayMessage } from "@/lib/api-error";

type NoticeVariant = "info" | "success" | "warning" | "error";

type SystemNoticeProps = {
  variant: NoticeVariant;
  title?: string;
  children: ReactNode;
  className?: string;
};

export function SystemNotice({ variant, title, children, className }: SystemNoticeProps) {
  const body =
    typeof children === "string" ? sanitizeDisplayMessage(children) : children;
  const safeTitle = typeof title === "string" ? sanitizeDisplayMessage(title) : title;

  return (
    <div
      className={clsx("app-notice", `app-notice--${variant}`, className)}
      role={variant === "error" ? "alert" : "status"}
      aria-live={variant === "error" ? "assertive" : "polite"}
    >
      {safeTitle ? <strong>{safeTitle}</strong> : null}
      <span>{body}</span>
    </div>
  );
}
