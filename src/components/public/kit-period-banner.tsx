"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PUBLIC_REGISTRATION_ENABLED } from "@/lib/site-features";

type PortalState = {
  enabled: boolean;
  announcement?: string;
};

export function KitPeriodBanner() {
  const [state, setState] = useState<PortalState | null>(null);

  useEffect(() => {
    if (!PUBLIC_REGISTRATION_ENABLED) return;
    let cancelled = false;
    fetch("/api/public/kit-portal", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return;
        setState({ enabled: Boolean(d.enabled), announcement: d.announcement });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!PUBLIC_REGISTRATION_ENABLED) return null;
  if (!state?.enabled) return null;

  return (
    <section className="kit-period-banner" role="region" aria-label="Kit ordering announcement">
      <div className="kit-period-banner-inner">
        <div className="kit-period-banner-text">
          <p className="kit-period-banner-eyebrow">FTPR Lions · Kit ordering open</p>
          <h2 className="kit-period-banner-title">Official kit ordering is now open</h2>
          <p className="kit-period-banner-copy">{state.announcement}</p>
        </div>
        <div className="kit-period-banner-actions">
          <Link href="/portal/register" className="btn nav-cta nav-cta--accent">
            Create account
          </Link>
          <Link href="/portal/login" className="btn nav-cta">
            Sign in
          </Link>
        </div>
      </div>
    </section>
  );
}
