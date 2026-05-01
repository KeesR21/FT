"use client";

import { useEffect, useRef, useState } from "react";
import type { CounterItem } from "@/components/kickstar/types";

function useCountUp(end: number, durationMs: number, startWhenVisible: boolean) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const done = useRef(false);

  useEffect(() => {
    if (!startWhenVisible) {
      done.current = true;
      let start: number | null = null;
      const step = (t: number) => {
        if (start === null) start = t;
        const p = Math.min((t - start) / durationMs, 1);
        setVal(Math.round(end * p));
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      return;
    }

    const el = ref.current;
    if (!el) return;

    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting || done.current) return;
        done.current = true;
        let start: number | null = null;
        const step = (t: number) => {
          if (start === null) start = t;
          const p = Math.min((t - start) / durationMs, 1);
          setVal(Math.round(end * p));
          if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      },
      { threshold: 0.2 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [end, durationMs, startWhenVisible]);

  return { ref, val };
}

type Props = {
  item: CounterItem;
  animate?: boolean;
};

/** Elementor `counter` widget — number + suffix + title */
export function KickstarCounter({ item, animate = true }: Props) {
  const { ref, val } = useCountUp(item.end, 1400, animate);
  const isAccent = item.numberVariant === "accent";
  const display = animate ? val : item.end;

  return (
    <div className="ks-counter-cell" ref={ref}>
      <div className={`ks-counter-num ${isAccent ? "ks-counter-num--accent" : ""}`}>
        {display}
        <span>{item.suffix}</span>
      </div>
      <div className="ks-counter-label">{item.title}</div>
    </div>
  );
}
