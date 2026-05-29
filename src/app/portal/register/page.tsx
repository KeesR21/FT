import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { RegisterForm } from "./register-form";
import { getCurrentPortalAccount } from "@/lib/portal-auth";
import { PUBLIC_REGISTRATION_ENABLED } from "@/lib/site-features";

export const dynamic = "force-dynamic";

const HERO_IMAGE = "/academy-3.png";

export default async function PortalRegisterPage() {
  if (!PUBLIC_REGISTRATION_ENABLED) {
    redirect("/portal/login");
  }
  const account = await getCurrentPortalAccount();
  if (account) redirect("/portal/dashboard");
  const googleClientId = process.env.GOOGLE_CLIENT_ID ?? "";

  return (
    <section className="portal-auth-bleed portal-auth-bleed--fast" aria-labelledby="portal-auth-title">
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
            Join the
            <br />
            Pride
          </h1>
          <p className="portal-auth-pitch-lead">
            Create your parent account using the email the academy already has on file. Your linked players appear automatically — no paperwork, no waiting.
          </p>
        </aside>

        <div className="portal-auth-panel">
          <div className="portal-auth-panel-brand" aria-hidden>
            <Image src="/logo.jpeg" alt="" width={56} height={56} className="portal-auth-panel-logo" priority />
          </div>
          <header className="portal-auth-panel-head">
            <h2 className="portal-auth-panel-title">Create account</h2>
            <p className="portal-auth-panel-sub">Already a member?</p>
          </header>
          <RegisterForm googleClientId={googleClientId} />
          <p className="portal-auth-panel-foot">
            By creating an account you agree to FTPR Lions&rsquo; <Link href="/" className="portal-auth-panel-link">Terms</Link> &middot;{" "}
            <Link href="/" className="portal-auth-panel-link">Privacy</Link>
          </p>
        </div>
      </div>
    </section>
  );
}
