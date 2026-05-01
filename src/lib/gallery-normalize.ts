import { buildDefaultSiteContent } from "@/lib/default-site-content";
import type { CmsGalleryAlbum, CmsGalleryItem, SiteContent } from "@/lib/types";

/** Ensure `galleryAlbums` exists; migrate legacy `galleryItems` from disk when needed. */
export function withNormalizedGallery(site: SiteContent): SiteContent {
  const base = buildDefaultSiteContent();
  const raw = site as SiteContent & { galleryItems?: CmsGalleryItem[] };

  if (raw.galleryAlbums && Array.isArray(raw.galleryAlbums) && raw.galleryAlbums.length > 0) {
    const galleryAlbums: CmsGalleryAlbum[] = raw.galleryAlbums.map((a) => {
      const images = (a.images || []).map((im) => ({ id: im.id, src: (im.src || "").trim() }));
      const firstImageSrc = images.find((im) => im.src.length > 0)?.src;
      const coverSrc =
        (a.coverSrc && a.coverSrc.trim()) ||
        firstImageSrc ||
        base.galleryAlbums[0]?.coverSrc ||
        "/gallery/FTPR_49.JPG";
      return {
        id: a.id,
        title: (a.title ?? "").trim(),
        coverSrc,
        images
      };
    });
    return { ...site, galleryAlbums };
  }

  const legacy = raw.galleryItems;
  if (legacy && legacy.length > 0) {
    return {
      ...site,
      galleryAlbums: [
        {
          id: "album-legacy",
          title: "Photos",
          coverSrc: legacy[0].src,
          images: legacy.map((p) => ({ id: p.id, src: p.src }))
        }
      ]
    };
  }

  return { ...site, galleryAlbums: base.galleryAlbums };
}
