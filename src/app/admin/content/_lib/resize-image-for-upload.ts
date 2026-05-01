/** Client-side downscale / recompress before CMS upload (keeps GIF unchanged). */

const HEAVY_BYTES = 2_600_000;

async function canvasToPreferredBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  const webp = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b && b.size > 0 && b.type === "image/webp" ? b : null), "image/webp", 0.82)
  );
  if (webp) return webp;
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b && b.size > 0 ? b : null), "image/jpeg", 0.88));
}

export async function resizeImageForUpload(file: File, maxEdge: number): Promise<File> {
  if (file.type === "image/gif" || !/^image\/(jpeg|png|webp)$/i.test(file.type)) {
    return file;
  }

  let bmp: ImageBitmap | null = null;
  let objectUrl: string | null = null;

  try {
    try {
      bmp = await createImageBitmap(file);
    } catch {
      objectUrl = URL.createObjectURL(file);
      try {
        const img = new Image();
        img.decoding = "async";
        await new Promise<void>((res, rej) => {
          img.onload = () => res();
          img.onerror = () => rej(new Error("decode"));
          img.src = objectUrl!;
        });
        bmp = await createImageBitmap(img);
      } catch {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        objectUrl = null;
        return file;
      }
    }

    const w = bmp.width;
    const h = bmp.height;
    const longest = Math.max(w, h);
    const tooLarge = longest > maxEdge;
    const tooHeavy = file.size > HEAVY_BYTES;
    if (!tooLarge && !tooHeavy) {
      bmp.close();
      return file;
    }

    const scale = tooLarge ? maxEdge / longest : 1;
    const tw = Math.max(1, Math.round(w * scale));
    const th = Math.max(1, Math.round(h * scale));

    const canvas = document.createElement("canvas");
    canvas.width = tw;
    canvas.height = th;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bmp.close();
      return file;
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bmp, 0, 0, tw, th);
    bmp.close();
    bmp = null;

    const blob = await canvasToPreferredBlob(canvas);
    if (!blob) return file;

    const base = file.name.replace(/\.[^/.]+$/, "") || "image";
    const ext = blob.type === "image/webp" ? "webp" : "jpg";
    return new File([blob], `${base}.${ext}`, { type: blob.type });
  } catch {
    if (bmp) {
      try {
        bmp.close();
      } catch {
        /* ignore */
      }
    }
    return file;
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

export function maxEdgeForCmsUsage(usage: "banner" | "section" | "card" | "thumb" | "logo"): number {
  switch (usage) {
    case "banner":
      return 2400;
    case "section":
      return 1920;
    case "card":
      return 1600;
    case "thumb":
      return 960;
    case "logo":
      return 512;
    default:
      return 1600;
  }
}
