import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  href: string;
  label: string;
  iconAfter?: ReactNode;
  variant?: "primary" | "secondary";
  external?: boolean;
  className?: string;
};

/** `jkit_button` — pill CTA, optional trailing icon */
export function KickstarJKitButton({ href, label, iconAfter, variant = "primary", external, className = "" }: Props) {
  const cls = variant === "secondary" ? "btn btn-secondary" : "btn";
  const inner = (
    <>
      <span>{label}</span>
      {iconAfter ? <span className="ks-w-jkit-btn__ico">{iconAfter}</span> : null}
    </>
  );
  if (external) {
    return (
      <a href={href} className={`${cls} ${className}`.trim()} target="_blank" rel="noopener noreferrer">
        {inner}
      </a>
    );
  }
  return (
    <Link href={href} className={`${cls} ${className}`.trim()}>
      {inner}
    </Link>
  );
}
