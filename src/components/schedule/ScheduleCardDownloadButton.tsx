"use client";

import { useState, type RefObject } from "react";
import { downloadSessionCardImage } from "@/lib/download-session-card-image";

type Props = {
  captureRef: RefObject<HTMLElement | null>;
  filename: string;
  className?: string;
};

export function ScheduleCardDownloadButton({ captureRef, filename, className }: Props) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function handleDownload() {
    const el = captureRef.current;
    if (!el || busy) return;

    setBusy(true);
    setErr("");
    try {
      await downloadSessionCardImage(el, filename);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save image");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={className ?? ""}>
      <button
        type="button"
        className="ws-session-popup__action-btn"
        onClick={handleDownload}
        disabled={busy}
        aria-label={busy ? "Saving image…" : "Download session card as image"}
        title={busy ? "Saving…" : "Download session card"}
      >
        <svg
          className="ws-session-popup__action-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 3v12" />
          <path d="m7 10 5 5 5-5" />
          <path d="M5 21h14" />
        </svg>
        <span className="ws-session-popup__action-label">{busy ? "Saving…" : "Download"}</span>
      </button>
      {err ? (
        <p className="ws-session-popup__download-error" role="alert">
          {err}
        </p>
      ) : null}
    </div>
  );
}
