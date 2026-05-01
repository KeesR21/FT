"use client";

import clsx from "clsx";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

const links = [
  ["/", "Home"],
  ["/about", "About"],
  ["/programs", "Programs"],
  ["/schedule", "Schedule"],
  ["/our-team", "Our Team"],
  ["/news", "News"],
  ["/events", "Events"],
  ["/gallery", "Gallery"],
  ["/contact", "Contact"],
  ["/locations", "Locations"]
];

export default function Navbar() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 900px)");
    const onChange = () => setOpen(false);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.classList.toggle("nav-mobile-open", open);
    return () => document.body.classList.remove("nav-mobile-open");
  }, [open]);

  return (
    <header className="topbar">
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
              <Link key={href} href={href} className="nav-link" onClick={() => setOpen(false)}>
                {label}
              </Link>
            ))}
            <Link href="/register" className="btn nav-cta" onClick={() => setOpen(false)}>
              Register
            </Link>
          </div>
        </div>
      </nav>
    </header>
  );
}
