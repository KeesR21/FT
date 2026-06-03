import Image from "next/image";
import Link from "next/link";
import { getPublicNavLinks } from "@/lib/public-nav-links";
import type { CmsContactInfo, CmsFooterContent, CmsSocialLink } from "@/lib/types";

function SocialIcon({ platform }: { platform: string }) {
  const p = platform.toLowerCase();
  if (p.includes("facebook"))
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" aria-hidden>
        <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c5.05-.5 9-4.76 9-9.95z"/>
      </svg>
    );
  if (p.includes("instagram"))
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" aria-hidden>
        <path d="M7.8 2h8.4C19.4 2 22 4.6 22 7.8v8.4c0 3.2-2.6 5.8-5.8 5.8H7.8C4.6 22 2 19.4 2 16.2V7.8C2 4.6 4.6 2 7.8 2zm-.2 2C5.61 4 4 5.61 4 7.6v8.8C4 18.39 5.61 20 7.6 20h8.8c1.99 0 3.6-1.61 3.6-3.6V7.6C20 5.61 18.39 4 16.4 4H7.6zm9.65 1.5a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5zM12 7a5 5 0 1 1 0 10A5 5 0 0 1 12 7zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/>
      </svg>
    );
  if (p.includes("youtube"))
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" aria-hidden>
        <path d="M21.58 7.19c-.23-.86-.91-1.54-1.77-1.77C18.25 5 12 5 12 5s-6.25 0-7.81.42c-.86.23-1.54.91-1.77 1.77C2 8.75 2 12 2 12s0 3.25.42 4.81c.23.86.91 1.54 1.77 1.77C5.75 19 12 19 12 19s6.25 0 7.81-.42c.86-.23 1.54-.91 1.77-1.77C22 15.25 22 12 22 12s0-3.25-.42-4.81zM10 15V9l5.2 3-5.2 3z"/>
      </svg>
    );
  if (p.includes("tiktok"))
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" aria-hidden>
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V9a8.18 8.18 0 0 0 4.78 1.52V7.07a4.85 4.85 0 0 1-1.01-.38z"/>
      </svg>
    );
  if (p.includes("whatsapp"))
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" aria-hidden>
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
      </svg>
    );
  if (p.includes("twitter") || p.includes("x.com") || p === "x")
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" aria-hidden>
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.259 5.63 5.905-5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    );
  if (p.includes("linkedin"))
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" aria-hidden>
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
      </svg>
    );
  // Generic globe for unknown platforms
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20" aria-hidden>
      <circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  );
}

function SocialLinks({ links }: { links: CmsSocialLink[] }) {
  if (!links.length) return null;
  return (
    <nav className="site-footer__social" aria-label="Social media">
      <ul className="site-footer__social-list">
        {links.map((s) => (
          <li key={s.id}>
            <a href={s.url} target="_blank" rel="noopener noreferrer" className="site-footer__social-link" title={s.platform} aria-label={s.platform}>
              <SocialIcon platform={s.platform} />
              <span className="sr-only">{s.platform}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

type SiteFooterProps = {
  footer: CmsFooterContent;
  contact: CmsContactInfo;
};

export function SiteFooter({ footer, contact }: SiteFooterProps) {
  const year = new Date().getFullYear();
  const quickLinks = footer?.quickLinks ?? [];
  const exploreLinks =
    quickLinks.length > 0
      ? quickLinks.map((l) => [l.href, l.label] as const)
      : getPublicNavLinks().filter(([href]) => href !== "/");

  const primaryEmail = contact?.emails?.[0]?.address;
  const primaryPhone = contact?.phones?.[0]?.number;
  const primaryOffice = contact?.offices?.[0]?.address;
  const socialLinks = contact?.socialLinks ?? [];

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
            <p className="site-footer__tagline">{footer?.tagline}</p>
            <SocialLinks links={socialLinks} />
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
          </div>
        </div>
      </div>
      <div className="site-footer__bottom">
        <div className="container site-footer__bottom-inner">
              <span className="site-footer__copy">
            © {year} {footer?.copyrightText}
          </span>
          {footer?.motto ? <span className="site-footer__motto">{footer.motto}</span> : null}
        </div>
      </div>
    </footer>
  );
}
