"use client";

import { useEffect, useRef, useState } from "react";
import {
  ELITE_DISCIPLINE_QUOTES,
  ELITE_TRAINING_QUOTES,
  type EliteTrainingQuote
} from "@/lib/elite-training-quotes";

const INTERVAL_MS = 10_000;
const FADE_MS = 350;

type QuotePair = {
  discipline: EliteTrainingQuote;
  player: EliteTrainingQuote;
};

function buildQuotePairs(
  discipline: EliteTrainingQuote[],
  players: EliteTrainingQuote[]
): QuotePair[] {
  const len = Math.max(discipline.length, players.length);
  return Array.from({ length: len }, (_, i) => ({
    discipline: discipline[i % discipline.length]!,
    player: players[i % players.length]!
  }));
}

function shuffleQuotePairs(pairs: QuotePair[]): QuotePair[] {
  const copy = [...pairs];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

type Props = {
  className?: string;
};

export function EliteInspiredQuoteSlider({ className }: Props) {
  const [pairs, setPairs] = useState(() =>
    buildQuotePairs(ELITE_DISCIPLINE_QUOTES, ELITE_TRAINING_QUOTES)
  );
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setPairs(shuffleQuotePairs(buildQuotePairs(ELITE_DISCIPLINE_QUOTES, ELITE_TRAINING_QUOTES)));
    setIndex(0);
  }, []);

  useEffect(() => {
    if (pairs.length <= 1) return;

    const interval = window.setInterval(() => {
      setVisible(false);
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = setTimeout(() => {
        setIndex((current) => (current + 1) % pairs.length);
        setVisible(true);
      }, FADE_MS);
    }, INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };
  }, [pairs.length]);

  const current = pairs[index] ?? pairs[0];
  if (!current) return null;

  const slideClass = visible ? " ks-elite-quotes__slide--visible" : "";
  const rootClassName = className ? className : "ks-elite-inspired";

  return (
    <div className={rootClassName}>
      <h2 className="ks-glass-h ks-elite-card__title">Inspired by Greatness</h2>

      <div className="ks-elite-quotes ks-elite-quotes--kicker" aria-live="polite" aria-atomic="true">
        <blockquote className={`ks-elite-quotes__slide${slideClass}`}>
          <p className="ks-elite-quotes__text">&ldquo;{current.discipline.text}&rdquo;</p>
        </blockquote>
      </div>

      <div className="ks-elite-quotes" aria-live="polite" aria-atomic="true">
        <blockquote className={`ks-elite-quotes__slide${slideClass}`}>
          <p className="ks-elite-quotes__text">&ldquo;{current.player.text}&rdquo;</p>
          <footer className="ks-elite-quotes__author">— {current.player.author}</footer>
        </blockquote>
      </div>
    </div>
  );
}
