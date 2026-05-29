"use client";

import { useEffect, useRef, useState } from "react";
import {
  ELITE_TRAINING_QUOTES,
  shuffleEliteTrainingQuotes,
  type EliteTrainingQuote
} from "@/lib/elite-training-quotes";

const INTERVAL_MS = 10_000;
const FADE_MS = 350;

type Props = {
  quotes?: EliteTrainingQuote[];
  className?: string;
  hideAuthor?: boolean;
};

export function EliteTrainingQuoteSlider({
  quotes: quotesProp,
  className,
  hideAuthor = false
}: Props) {
  const source = quotesProp ?? ELITE_TRAINING_QUOTES;
  const [quotes, setQuotes] = useState(source);
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setQuotes(shuffleEliteTrainingQuotes(source));
    setIndex(0);
  }, [source]);

  useEffect(() => {
    if (quotes.length <= 1) return;

    const interval = window.setInterval(() => {
      setVisible(false);
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = setTimeout(() => {
        setIndex((current) => (current + 1) % quotes.length);
        setVisible(true);
      }, FADE_MS);
    }, INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };
  }, [quotes.length]);

  const current = quotes[index] ?? quotes[0];
  if (!current) return null;
  const rootClassName = className ? className : "ks-elite-quotes";

  return (
    <div className={rootClassName} aria-live="polite" aria-atomic="true">
      <blockquote
        className={`ks-elite-quotes__slide${visible ? " ks-elite-quotes__slide--visible" : ""}`}
      >
        <p className="ks-elite-quotes__text">&ldquo;{current.text}&rdquo;</p>
        {!hideAuthor ? <footer className="ks-elite-quotes__author">— {current.author}</footer> : null}
      </blockquote>
    </div>
  );
}
