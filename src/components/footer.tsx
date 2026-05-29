import Image from "next/image";
import Link from "next/link";
import { getPublicNavLinks } from "@/lib/public-nav-links";

const exploreLinks = getPublicNavLinks().filter(([href]) => href !== "/");

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
              Professional youth development in Rwanda — structured training, competitive fixtures, and clear
              communication with families.
            </p>
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
              <p>Kigali, Rwanda</p>
              <p>
                <a href="mailto:info@ftprlionsacademy.com">info@ftprlionsacademy.com</a>
              </p>
              <p>
                <a href="tel:+250788614755">+250 788 614 755</a>
              </p>
            </address>
            <p className="site-footer__hours muted">Mon – Fri, 09:00 – 17:00</p>
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
