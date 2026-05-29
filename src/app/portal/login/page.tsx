import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoginForm } from "./login-form";
import { getCurrentPortalAccount } from "@/lib/portal-auth";

export const dynamic = "force-dynamic";

const HERO_IMAGE = "/amahoro-stadium-hero.png";

export default async function PortalLoginPage() {
  const account = await getCurrentPortalAccount();
  if (account) redirect("/portal/dashboard");
  const googleClientId = process.env.GOOGLE_CLIENT_ID ?? "";

  return (
    <section className="portal-auth-bleed" aria-labelledby="portal-auth-title">
      <div className="portal-auth-bleed-bg" aria-hidden>
        <Image
          src={HERO_IMAGE}
          alt=""
          fill
          priority
          sizes="100vw"
          quality={95}
          className="portal-auth-bleed-img portal-auth-bleed-img--crisp"
        />
        <div className="portal-auth-bleed-overlay" />
      </div>

      <div className="portal-auth-bleed-grid">
        <aside className="portal-auth-pitch">
          <p className="portal-auth-pitch-eyebrow">FTPR Lions · Parent Portal</p>
          <h1 id="portal-auth-title" className="portal-auth-pitch-title">
            Welcome
            <br />
            Back
          </h1>
          <p className="portal-auth-pitch-lead">
            Sign in to manage your child&rsquo;s academy life — kit orders, payments, and updates from your coaching team, all in one calm place.
          </p>
        </aside>

        <div className="portal-auth-panel">
          <div className="portal-auth-panel-brand" aria-hidden>
            <Image src="/logo.jpeg" alt="" width={56} height={56} className="portal-auth-panel-logo" priority />
          </div>
          <header className="portal-auth-panel-head">
            <h2 className="portal-auth-panel-title">Sign in</h2>
            <p className="portal-auth-panel-sub">Use the email the academy has on file.</p>
          </header>
          <Suspense fallback={null}>
            <LoginForm googleClientId={googleClientId} />
          </Suspense>
          <p className="portal-auth-panel-foot">
            By clicking on &ldquo;Sign in now&rdquo; you agree to FTPR Lions&rsquo; <Link href="/" className="portal-auth-panel-link">Terms</Link> &middot;{" "}
            <Link href="/" className="portal-auth-panel-link">Privacy</Link>
          </p>
        </div>
      </div>
    </section>
  );
}
