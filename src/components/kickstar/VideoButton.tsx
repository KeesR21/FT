type Props = {
  url: string;
  label?: string;
  className?: string;
};

/** `elementskit-video` — opens YouTube (or any URL) in new tab; kit uses popup modal */
export function KickstarVideoButton({ url, label = "Play Video", className = "" }: Props) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`ks-w-video-btn ${className}`.trim()}
      aria-label={label}
    >
      <span className="ks-w-video-btn__circle" aria-hidden>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z" />
        </svg>
      </span>
      <span className="ks-w-video-btn__label">{label}</span>
    </a>
  );
}
