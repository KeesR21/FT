"use client";

import { useState } from "react";

export type AccordionItem = { id: string; title: string; content: string };

type Props = {
  items: AccordionItem[];
  className?: string;
};

/** `elementskit-accordion` */
export function KickstarAccordion({ items, className = "" }: Props) {
  const [open, setOpen] = useState<string | null>(items[0]?.id ?? null);

  return (
    <div className={`ks-w-accordion ${className}`.trim()}>
      {items.map((item) => {
        const isOpen = open === item.id;
        return (
          <div key={item.id} className={`ks-w-accordion__item ${isOpen ? "is-open" : ""}`}>
            <button
              type="button"
              className="ks-w-accordion__trigger"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : item.id)}
            >
              {item.title}
              <span className="ks-w-accordion__chev" aria-hidden>
                {isOpen ? "−" : "+"}
              </span>
            </button>
            {isOpen ? <div className="ks-w-accordion__panel muted">{item.content}</div> : null}
          </div>
        );
      })}
    </div>
  );
}
