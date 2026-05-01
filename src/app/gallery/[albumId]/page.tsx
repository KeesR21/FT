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

  return (
    <div className="gallery-album-page">
      <Link href="/gallery" className="gallery-album-back">
        ← Gallery
      </Link>
      <div className="gallery-album-page__mosaic-wrap">
        <GalleryAlbumMosaic images={album.images} />
      </div>
    </div>
  );
}
