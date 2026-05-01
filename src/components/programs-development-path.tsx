"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { CmsPathwayLineStep } from "@/lib/types";

function buildSmoothPath(points: { x: number; y: number }[], vertical: boolean) {
  if (points.length < 2) return "";
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const p0 = points[i - 1];
    const p1 = points[i];
    const mx = (p0.x + p1.x) / 2;
    const my = (p0.y + p1.y) / 2;
    if (!vertical) {
      d += ` Q ${mx} ${my - 36} ${p1.x} ${p1.y}`;
    } else {
      d += ` Q ${mx + 32} ${my} ${p1.x} ${p1.y}`;
    }
  }
  return d;
}

type Props = {
  title: string;
  lead: string;
  scrollLabel: string;
  items: CmsPathwayLineStep[];
};

export function ProgramsDevelopmentPath({ title, lead, scrollLabel, items }: Props) {
  const uid = useId().replace(/:/g, "");
  const gradId = `dev-path-grad-${uid}`;
  const containerRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const dotRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [pathD, setPathD] = useState("");
  const [pathLen, setPathLen] = useState(0);
  const [vertical, setVertical] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const computePathD = useCallback(() => {
    const container = containerRef.current;
    if (!container || items.length < 2) {
      setPathD("");
      return;
    }
    const cRect = container.getBoundingClientRect();
    if (cRect.width < 8 || cRect.height < 8) return;

    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < items.length; i++) {
      const el = dotRefs.current[i];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      pts.push({
        x: r.left + r.width / 2 - cRect.left,
        y: r.top + r.height / 2 - cRect.top
      });
    }
    if (pts.length < 2) return;
    setPathD(buildSmoothPath(pts, vertical));
  }, [items, vertical]);

  useLayoutEffect(() => {
    computePathD();
  }, [computePathD, items]);

  useLayoutEffect(() => {
    const path = pathRef.current;
    if (!path || !pathD) {
      setPathLen(0);
      return;
    }
    setPathLen(path.getTotalLength());
  }, [pathD]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 719px)");
    const onMq = () => setVertical(mq.matches);
    onMq();
    mq.addEventListener("change", onMq);
    return () => mq.removeEventListener("change", onMq);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => computePathD());
    ro.observe(el);
    return () => ro.disconnect();
  }, [computePathD]);

  if (items.length < 2) return null;

  const traceDash = pathLen > 0 ? Math.max(22, Math.round(pathLen * 0.07)) : 0;
  const tracePeriod = pathLen > 0 ? traceDash + pathLen : 0;

  return (
    <div className="dev-path programs-pop" style={{ animationDelay: "0.08s" }}>
      <div className="dev-path__header">
        <h3 className="dev-path__title">{title}</h3>
        <p className="dev-path__lead muted">{lead}</p>
      </div>

      <div className="dev-path__scroller" aria-hidden>
        <span className="dev-path__scroller-line" />
        <span className="dev-path__scroller-text">{scrollLabel.trim() || "Follow the pathway"}</span>
      </div>

      <div
        ref={containerRef}
        className={`dev-path__wrap${vertical ? " dev-path__wrap--vertical" : ""}`}
      >
        <svg className="dev-path__svg" aria-hidden>
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#00aaff" />
              <stop offset="55%" stopColor="#ff00d8" />
              <stop offset="100%" stopColor="#bb6b2a" />
            </linearGradient>
          </defs>
          <path
            ref={pathRef}
            key={pathLen > 0 ? `dev-path-${Math.round(pathLen)}` : "dev-path-empty"}
            className="dev-path__path"
            d={pathD}
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth={vertical ? 3 : 3.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={pathLen > 0 ? pathLen : undefined}
            strokeDashoffset={pathLen > 0 ? pathLen : undefined}
          />
          {pathLen > 0 && pathD ? (
            <path
              key={`dev-trace-${Math.round(pathLen)}`}
              className="dev-path__trace"
              d={pathD}
              fill="none"
              stroke="rgba(255, 255, 255, 0.92)"
              strokeWidth={vertical ? 4 : 4.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={
                {
                  strokeDasharray: `${traceDash} ${pathLen}`,
                  strokeDashoffset: 0,
                  ["--dev-trace-period" as string]: `${tracePeriod}px`
                } as CSSProperties
              }
            />
          ) : null}
        </svg>

        <div className="dev-path__nodes" role="list">
          {items.map((item, index) => {
            const expanded = openId === item.id;
            return (
              <div
                key={item.id}
                className={`dev-path__node-col${expanded ? " dev-path__node-col--open" : ""}`}
                role="listitem"
              >
                <button
                  type="button"
                  className="dev-path__node"
                  aria-expanded={expanded}
                  aria-controls={`dev-path-desc-${item.id}`}
                  id={`dev-path-btn-${item.id}`}
                  onClick={() => setOpenId((id) => (id === item.id ? null : item.id))}
                >
                  <span
                    ref={(el) => {
                      dotRefs.current[index] = el;
                    }}
                    className="dev-path__dot"
                    aria-hidden
                  />
                  <span className="dev-path__name">{item.name}</span>
                </button>
                <p id={`dev-path-desc-${item.id}`} className="dev-path__desc" role="region">
                  {item.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
