import type { ReactNode } from "react";

/** Finance navigation lives in the sidebar submenu; content uses full width. */
export default function FinanceLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
