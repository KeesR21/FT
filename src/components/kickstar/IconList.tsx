import Image from "next/image";
import type { ReactNode } from "react";

type Props = {
  icon?: ReactNode;
  text: string;
  align?: "left" | "center" | "right";
  className?: string;
};

const defaultListIcon = (
  <Image
    src="/logo.jpeg"
    alt=""
    width={26}
    height={26}
    className="ks-ftpr-logo ks-ftpr-logo--list"
  />
);

/** Elementor `icon-list` — small label row with icon + text */
export function KickstarIconList({ icon, text, align = "center", className = "" }: Props) {
  return (
    <div className={`ks-w-icon-list ks-w-icon-list--${align} ${className}`.trim()}>
      <span className="ks-w-icon-list__ico" aria-hidden>
        {icon ?? defaultListIcon}
      </span>
      <span className="ks-w-icon-list__txt">{text}</span>
    </div>
  );
}
