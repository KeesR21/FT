import Image from "next/image";
import Link from "next/link";

/** Matches primary nav — keeps footer useful on every public page. */
const exploreLinks = [
  ["/about", "About"],
  ["/programs", "Programs"],
  ["/schedule", "Schedule"],
  ["/our-team", "Our Team"],
  ["/news", "News"],
  ["/events", "Events"],
  ["/gallery", "Gallery"],
  ["/contact", "Contact"],
  ["/locations", "Locations"],
  ["/register", "Registration"]
];

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <div className="site-footer__accent" aria-hidden />
      <div className="site-footer__main">
        <div className="container site-footer__grid">
          <div className="site-footer__brand">
            <Link href="/" className="logo-wrap footer-logo-link">
              <Image src="/logo.jpeg" alt="FTPR Lions logo" width={52} height={52} className="logo" />
              <div>
                <div className="brand-title">FTPR Lions</div>
                <div className="brand-sub">Football Academy</div>
              </div>
            </Link>
            <p className="site-footer__tagline">
              Professional youth development in Rwanda — structured training, competitive fixtures, and clear communication
              with families.
            </p>
          </div>
          <div className="site-footer__explore">
            <h2 className="site-footer__heading">Explore</h2>
            <nav className="site-footer__nav" aria-label="Footer">
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
              <p>Kigali, Rwanda</p>
              <p>
                <a href="mailto:info@ftprlions.com">info@ftprlions.com</a>
              </p>
              <p>
                <a href="tel:+250780000000">+250 780 000 000</a>
              </p>
            </address>
            <p className="site-footer__hours muted">Office hours: Mon–Fri, 09:00 – 17:00</p>
          </div>
        </div>
      </div>
      <div className="site-footer__bottom">
        <div className="container site-footer__bottom-inner">
          <span className="site-footer__copy">© {year} FTPR Lions Football Academy. All rights reserved.</span>
          <span className="site-footer__motto">Discipline · Excellence · Character</span>
        </div>
      </div>
    </footer>
  );
}
