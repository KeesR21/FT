type Social = { label: string; href: string };

type Props = {
  items: Social[];
  className?: string;
};

/** Elementor `social-icons` */
export function KickstarSocialIcons({ items, className = "" }: Props) {
  return (
    <div className={`ks-w-social ${className}`.trim()}>
      {items.map((s) => (
        <a key={s.href} href={s.href} className="ks-w-social__link" target="_blank" rel="noopener noreferrer">
          {s.label}
        </a>
      ))}
    </div>
  );
}
