"use client";

import clsx from "clsx";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getPublicNavLinks } from "@/lib/public-nav-links";

const links = getPublicNavLinks();

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() ?? "";

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 900px)");
    const onChange = () => setOpen(false);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Close on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.classList.toggle("nav-mobile-open", open);
    return () => document.body.classList.remove("nav-mobile-open");
  }, [open]);

  /*
   * Guard against duplicate topbars from stale bfcache / service worker snapshots.
   */
  useEffect(() => {
    if (typeof document === "undefined") return;
    const dedupe = () => {
      const bars = document.querySelectorAll<HTMLElement>('header.topbar, [data-singleton="ftpr-topbar"]');
      if (bars.length <= 1) return;
      const canonical = document.getElementById("ftpr-topbar");
      bars.forEach((el) => {
        if (canonical && el !== canonical) el.remove();
      });
    };
    dedupe();
    const mo = new MutationObserver(dedupe);
    mo.observe(document.body, { childList: true, subtree: false });
    return () => mo.disconnect();
  }, []);

  return (
    <header id="ftpr-topbar" className="topbar" data-singleton="ftpr-topbar">
      <div className="topbar-strip" aria-hidden />
      <nav className="container nav-inner" aria-label="Primary">
        <Link href="/" className="logo-wrap nav-brand" onClick={() => setOpen(false)}>
          <Image src="/logo.jpeg" alt="FTPR Lions logo" width={52} height={52} className="logo" priority />
          <div>
            <div className="brand-title">FTPR Lions</div>
            <div className="brand-sub">Football Academy</div>
          </div>
        </Link>

        <button
          type="button"
          className={clsx("nav-toggle", open && "nav-toggle--open")}
          aria-expanded={open}
          aria-controls="primary-navigation"
          onClick={() => setOpen((v) => !v)}
        >
          <span className="nav-toggle-bar" aria-hidden />
          <span className="nav-toggle-bar" aria-hidden />
          <span className="nav-toggle-bar" aria-hidden />
          <span className="visually-hidden">{open ? "Close menu" : "Open menu"}</span>
        </button>

        <div id="primary-navigation" className={clsx("nav-menu-panel", open && "nav-menu-panel--open")}>
          <div className="nav-links">
            {links.map(([href, label]) => (
              <Link
                key={href}
                href={href}
                className={clsx("nav-link", isActive(pathname, href) && "nav-link--active")}
                aria-current={isActive(pathname, href) ? "page" : undefined}
                onClick={() => setOpen(false)}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      </nav>
    </header>
  );
}
