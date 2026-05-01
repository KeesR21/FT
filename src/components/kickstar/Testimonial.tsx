import Image from "next/image";

type Props = {
  quote: string;
  name: string;
  role: string;
  imageSrc: string;
  imageAlt?: string;
  /** Small label above the quote, e.g. “What parents say” */
  eyebrow?: string;
  className?: string;
};

/** `elementskit-testimonial` — quote card with accent treatment */
export function KickstarTestimonial({
  quote,
  name,
  role,
  imageSrc,
  imageAlt = "",
  eyebrow,
  className = ""
}: Props) {
  return (
    <blockquote className={`ks-w-testi ks-w-testi--panel ${className}`.trim()}>
      <span className="ks-w-testi__mark" aria-hidden>
        &ldquo;
      </span>
      {eyebrow ? <p className="ks-w-testi__eyebrow">{eyebrow}</p> : null}
      <div className="ks-w-testi__stars" aria-label="5 out of 5 stars">
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} className="ks-w-testi__star">
            ★
          </span>
        ))}
      </div>
      <p className="ks-w-testi__quote">{quote}</p>
      <footer className="ks-w-testi__foot">
        <div className="ks-w-testi__avatar-wrap">
          <Image src={imageSrc} alt={imageAlt} width={56} height={56} className="ks-w-testi__avatar" />
        </div>
        <div className="ks-w-testi__meta">
          <cite className="ks-w-testi__name">{name}</cite>
          <div className="ks-w-testi__role">{role}</div>
        </div>
      </footer>
    </blockquote>
  );
}
