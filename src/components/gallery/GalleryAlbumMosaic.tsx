"use client";

import Image from "next/image";
import { useCallback, useState } from "react";
import type { CmsGalleryAlbumImage } from "@/lib/types";
import { GalleryLightbox } from "./GalleryLightbox";

type Props = {
  images: CmsGalleryAlbumImage[];
};

export function GalleryAlbumMosaic({ images }: Props) {
  const [lightbox, setLightbox] = useState<{ open: boolean; index: number }>({ open: false, index: 0 });

  const filled = images.filter((im) => im.src?.trim());

  const openAt = useCallback((index: number) => {
    setLightbox({ open: true, index });
  }, []);

  const close = useCallback(() => {
    setLightbox((s) => ({ ...s, open: false }));
  }, []);

  if (filled.length === 0) {
    return <p className="muted gallery-mosaic-empty">No images in this album yet.</p>;
  }

  return (
    <>
      <div className="gallery-mosaic">
        {filled.map((im, i) => {
          const unopt = im.src.startsWith("/uploads/");
          return (
            <button
              key={im.id}
              type="button"
              className="gallery-mosaic__cell"
              onClick={() => openAt(i)}
              aria-label={`Open image ${i + 1} of ${filled.length}`}
            >
              <Image
                src={im.src}
                alt=""
                width={800}
                height={600}
                className="gallery-mosaic__img"
                sizes="(max-width: 640px) 50vw, (max-width: 1100px) 33vw, 25vw"
                loading={i < 12 ? "eager" : "lazy"}
                unoptimized={unopt}
              />
              <span className="gallery-mosaic__shine" aria-hidden />
            </button>
          );
        })}
      </div>
      <GalleryLightbox images={filled} open={lightbox.open} initialIndex={lightbox.index} onClose={close} />
    </>
  );
}
