"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

type Img = { id: string; src: string };

type Props = {
  images: Img[];
  open: boolean;
  initialIndex: number;
  onClose: () => void;
};

export function GalleryLightbox({ images, open, initialIndex, onClose }: Props) {
  const [index, setIndex] = useState(initialIndex);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      setIndex(initialIndex);
      const t = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(t);
    }
    setVisible(false);
  }, [open, initialIndex]);

  const go = useCallback(
    (delta: number) => {
      if (images.length === 0) return;
      setIndex((i) => (i + delta + images.length) % images.length);
    },
    [images.length]
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, go, onClose]);

  if (!open || images.length === 0) return null;

  const cur = images[index];
  if (!cur) return null;

  const unopt = cur.src.startsWith("/uploads/");

  return (
    <div
      className={`gallery-lightbox${visible ? " gallery-lightbox--visible" : ""}`}
      role="dialog"
      aria-modal
      aria-label="Image viewer"
    >
      <button type="button" className="gallery-lightbox__backdrop" tabIndex={-1} aria-hidden onClick={onClose} />
      <div className="gallery-lightbox__chrome">
        <button type="button" className="gallery-lightbox__close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <div className="gallery-lightbox__row">
          <button
            type="button"
            className="gallery-lightbox__nav gallery-lightbox__nav--prev"
            onClick={() => go(-1)}
            disabled={images.length < 2}
            aria-label="Previous image"
          >
            ‹
          </button>
          <div className="gallery-lightbox__frame">
            <Image
              key={cur.id}
              src={cur.src}
              alt=""
              width={1920}
              height={1080}
              className="gallery-lightbox__img"
              sizes="100vw"
              priority
              unoptimized={unopt}
            />
          </div>
          <button
            type="button"
            className="gallery-lightbox__nav gallery-lightbox__nav--next"
            onClick={() => go(1)}
            disabled={images.length < 2}
            aria-label="Next image"
          >
            ›
          </button>
        </div>
      </div>
    </div>
  );
}
