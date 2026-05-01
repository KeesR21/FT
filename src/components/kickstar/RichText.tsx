import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
};

/** Elementor `text-editor` — prefer React children; avoids raw HTML unless trusted */
export function KickstarRichText({ children, className = "" }: Props) {
  return <div className={`ks-w-rich-text muted ${className}`.trim()}>{children}</div>;
}
