import Image from "next/image";
import Link from "next/link";
import { getPublicNavLinks } from "@/lib/public-nav-links";
import type { CmsContactInfo, CmsFooterContent } from "@/lib/types";

type SiteFooterProps = {
  footer: CmsFooterContent;
  contact: CmsContactInfo;
};

export function SiteFooter({ footer, contact }: SiteFooterProps) {
  const year = new Date().getFullYear();
  const exploreLinks =
    footer.quickLinks.length > 0
      ? footer.quickLinks.map((l) => [l.href, l.label] as const)
      : getPublicNavLinks().filter(([href]) => href !== "/");

  const primaryEmail = contact.emails[0]?.address;
  const primaryPhone = contact.phones[0]?.number;
  const primaryOffice = contact.offices[0]?.address;
  const hours = contact.offices[0]?.label;

  return (
    <footer className="site-footer">
      <div className="site-footer__accent" aria-hidden />
      <div className="site-footer__main">
        <div className="container site-footer__grid">
          <div className="site-footer__brand">
            <Link href="/" className="logo-wrap footer-logo-link">
              <Image
                src={footer.logoSrc || "/logo.jpeg"}
                alt={`${footer.brandTitle} logo`}
                width={52}
                height={52}
                className="logo"
              />
              <div>
                <div className="brand-title">{footer.brandTitle}</div>
                <div className="brand-sub">{footer.brandSubtitle}</div>
              </div>
            </Link>
            <p className="site-footer__tagline">{footer.tagline}</p>
            {contact.socialLinks.length > 0 ? (
              <nav className="site-footer__social" aria-label="Social media">
                <ul className="site-footer__link-list">
                  {contact.socialLinks.map((s) => (
                    <li key={s.id}>
                      <a href={s.url} target="_blank" rel="noopener noreferrer">
                        {s.platform}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            ) : null}
          </div>

          <div className="site-footer__explore">
            <h2 className="site-footer__heading">Explore</h2>
            <nav className="site-footer__nav" aria-label="Footer navigation">
              <ul className="site-footer__link-list">
                {exploreLinks.map(([href, label]) => (
                  <li key={href}>
                    <Link href={href}>{label}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <div className="site-footer__contact">
            <h2 className="site-footer__heading">Contact</h2>
            <address className="site-footer__address">
              {primaryOffice ? <p>{primaryOffice}</p> : null}
              {primaryEmail ? (
                <p>
                  <a href={`mailto:${primaryEmail}`}>{primaryEmail}</a>
                </p>
              ) : null}
              {primaryPhone ? (
                <p>
                  <a href={`tel:${primaryPhone.replace(/\s/g, "")}`}>{primaryPhone}</a>
                </p>
              ) : null}
            </address>
            {hours ? <p className="site-footer__hours muted">{hours}</p> : null}
          </div>
        </div>
      </div>
      <div className="site-footer__bottom">
        <div className="container site-footer__bottom-inner">
          <span className="site-footer__copy">
            © {year} {footer.copyrightText}
          </span>
          {footer.motto ? <span className="site-footer__motto">{footer.motto}</span> : null}
        </div>
      </div>
    </footer>
  );
}
