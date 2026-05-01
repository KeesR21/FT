"use client";

import { KickstarCounter } from "@/components/kickstar/Counter";
import type { CounterItem } from "@/components/kickstar/types";

type Props = {
  items: CounterItem[];
  className?: string;
};

export function KickstarCounterRow({ items, className = "" }: Props) {
  return (
    <div className={`ks-counter-grid ${className}`.trim()}>
      {items.map((item) => (
        <KickstarCounter key={item.title} item={item} />
      ))}
    </div>
  );
}
