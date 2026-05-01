import type { ReactNode } from "react";

type Props = {
  icon: ReactNode;
  title: string;
  description?: string;
  className?: string;
};

/** Elementor `icon-box` */
export function KickstarIconBox({ icon, title, description, className = "" }: Props) {
  return (
    <div className={`ks-w-icon-box ${className}`.trim()}>
      <div className="ks-w-icon-box__icon" aria-hidden>
        {icon}
      </div>
      <div>
        <h4 className="ks-w-icon-box__title">{title}</h4>
        {description ? <p className="ks-w-icon-box__desc muted">{description}</p> : null}
      </div>
    </div>
  );
}
