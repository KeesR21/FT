import Link from "next/link";
import { notFound } from "next/navigation";
import { GalleryAlbumMosaic } from "@/components/gallery/GalleryAlbumMosaic";
import { getCachedSiteContent } from "@/lib/get-site-content-cached";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ albumId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { albumId } = await params;
  const id = decodeURIComponent(albumId);
  const c = await getCachedSiteContent();
  const album = c.galleryAlbums.find((a) => a.id === id);
  if (!album) return { title: "Gallery" };
  const t = album.title?.trim() || "Untitled album";
  return { title: `${t} · Gallery` };
}

export default async function GalleryAlbumPage({ params }: Props) {
  const { albumId } = await params;
  const id = decodeURIComponent(albumId);
  const c = await getCachedSiteContent();
  const album = c.galleryAlbums.find((a) => a.id === id);
  if (!album) notFound();

  const photoCount = album.images.length;

  return (
    <div className="gallery-album-page">
      <div className="container gallery-album-page__header">
        <Link href="/gallery" className="gallery-album-back">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m15 18-6-6 6-6" />
          </svg>
          Back to Gallery
        </Link>
        <div className="gallery-album-page__meta">
          <h1 className="gallery-album-page__title">{album.title?.trim() || "Untitled album"}</h1>
          <p className="gallery-album-page__count muted">
            {photoCount === 0
              ? "No photos yet"
              : `${photoCount} photo${photoCount === 1 ? "" : "s"}`}
          </p>
        </div>
      </div>

      <div className="gallery-album-page__mosaic-wrap">
        <GalleryAlbumMosaic images={album.images} />
      </div>
    </div>
  );
}
