import type { ElementsKitTitle, KickstarHeadingTag, TextAlign } from "@/components/kickstar/types";

type Props = {
  title: ElementsKitTitle;
  subtitle?: string;
  as?: KickstarHeadingTag;
  align?: TextAlign;
  className?: string;
};

/**
 * `elementskit-heading` — title may contain `{{segments}}` rendered as kit “focused” chips (bg alt).
 */
export function KickstarElementsKitHeading({ title, subtitle, as: Tag = "h1", align = "center", className = "" }: Props) {
  const parts = title.split(/(\{\{[^}]+\}\})/g);

  const titleClass =
    Tag === "h1"
      ? "ks-mega-title ks-w-ekit-heading__title"
      : Tag === "h2"
        ? "ks-section-h ks-w-ekit-heading__title"
        : "ks-w-ekit-heading__title";

  return (
    <div className={`ks-w-ekit-heading ks-w-ekit-heading--${align} ${className}`.trim()}>
      <Tag className={titleClass}>
        {parts.map((part, i) => {
          const m = part.match(/^\{\{([^}]+)\}\}$/);
          if (m) {
            return (
              <span key={i} className="ks-title-em">
                {m[1]}
              </span>
            );
          }
          return <span key={i}>{part}</span>;
        })}
      </Tag>
      {subtitle ? <p className="ks-hero-sub">{subtitle}</p> : null}
    </div>
  );
}
