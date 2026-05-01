import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
};

/** Glass morphism container (JKit glass + kit border) */
export function KickstarGlassCard({ children, className = "" }: Props) {
  return <article className={`ks-glass-card ${className}`.trim()}>{children}</article>;
}
