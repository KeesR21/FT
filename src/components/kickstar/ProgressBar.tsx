"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  percent: number;
  label?: string;
  className?: string;
};

/** `elementskit-progressbar` — animated bar when visible */
export function KickstarProgressBar({ percent, label, className = "" }: Props) {
  const [w, setW] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setW(Math.min(100, Math.max(0, percent)));
      },
      { threshold: 0.1 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [percent]);

  return (
    <div className={`ks-w-progress ${className}`.trim()} ref={ref}>
      {label ? <div className="ks-w-progress__label">{label}</div> : null}
      <div className="ks-w-progress__track">
        <div className="ks-w-progress__fill" style={{ width: `${w}%` }} />
      </div>
    </div>
  );
}
