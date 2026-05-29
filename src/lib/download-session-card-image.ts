import { toPng } from "html-to-image";

const CAPTURE_PIXEL_RATIO = 3;

function slugPart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

/** Build a filesystem-safe filename for a schedule session card image. */
export function sessionCardImageFilename(opts: {
  type: "training" | "match" | "rest";
  startsAt: string;
  title: string;
}): string {
  const date = opts.startsAt.slice(0, 10);
  const kind = opts.type === "match" ? "match" : opts.type === "rest" ? "rest" : "training";
  const title = slugPart(opts.title) || kind;
  return `ftpr-schedule-${kind}-${date}-${title}.png`;
}

function waitForPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

function fixClonedImages(clone: HTMLElement, source: HTMLElement): void {
  const sourceImages = source.querySelectorAll("img");
  const cloneImages = clone.querySelectorAll("img");
  cloneImages.forEach((img, index) => {
    const srcImg = sourceImages[index];
    if (srcImg) {
      img.src = srcImg.currentSrc || srcImg.src;
      img.crossOrigin = "anonymous";
    }
  });
}

/**
 * Clone is rendered off-screen with export-only layout so the visible popup never moves.
 */
function createOffscreenCaptureClone(source: HTMLElement): { node: HTMLElement; cleanup: () => void } {
  const width = Math.round(source.getBoundingClientRect().width);
  const clone = source.cloneNode(true) as HTMLElement;

  clone.classList.add("ws-session-popup__capture--export-clone");
  clone.style.width = `${width}px`;
  clone.style.maxHeight = "none";
  clone.style.height = "auto";
  clone.style.overflow = "visible";
  clone.style.flex = "none";

  const inner = clone.querySelector(".ws-session-popup__inner");
  if (inner instanceof HTMLElement) {
    inner.style.marginTop = "0";
    inner.style.marginBottom = "0";
  }

  fixClonedImages(clone, source);

  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.className = "ws-session-popup__export-host";
  host.style.cssText = [
    "position: fixed",
    "left: -10000px",
    "top: 0",
    "z-index: -1",
    "width: 0",
    "height: 0",
    "overflow: visible",
    "pointer-events: none"
  ].join(";");

  host.appendChild(clone);
  document.body.appendChild(host);

  return {
    node: clone,
    cleanup: () => host.remove()
  };
}

async function waitForImages(root: HTMLElement): Promise<void> {
  const images = Array.from(root.querySelectorAll("img"));
  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          img.onload = () => resolve();
          img.onerror = () => resolve();
        })
    )
  );
}

/**
 * Captures the session card as PNG without changing the on-screen popup layout.
 */
export async function downloadSessionCardImage(element: HTMLElement, filename: string): Promise<void> {
  if (typeof document !== "undefined" && document.fonts?.ready) {
    await document.fonts.ready;
  }

  const { node, cleanup } = createOffscreenCaptureClone(element);

  try {
    await waitForPaint();
    await waitForImages(node);

    const width = node.offsetWidth;
    const height = node.scrollHeight;

    const dataUrl = await toPng(node, {
      width,
      height,
      pixelRatio: CAPTURE_PIXEL_RATIO,
      cacheBust: true,
      backgroundColor: "#0f172a",
      skipFonts: false
    });

    const link = document.createElement("a");
    link.download = filename.endsWith(".png") ? filename : `${filename}.png`;
    link.href = dataUrl;
    link.click();
  } finally {
    cleanup();
  }
}
