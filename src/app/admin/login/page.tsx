"use client";

import Image from "next/image";
import { Suspense } from "react";
import { AdminLoginForm } from "@/components/admin/admin-login-form";

const LOGIN_BG = "/gallery/FTPR_18.JPG";

function AdminLoginFallback() {
  return (
    <div className="admin-login-page">
      <div className="admin-login-bg" aria-hidden>
        <Image src={LOGIN_BG} alt="" fill className="admin-login-bg-image" sizes="100vw" priority quality={80} />
        <div className="admin-login-bg-veil" />
        <div className="admin-login-bg-accent" />
      </div>
      <div className="admin-login-page-inner">
        <div className="admin-login-shell">
          <div className="admin-login-form-col admin-login-form-col--loading">
            <span className="al-spinner" aria-hidden />
            Loading…
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminLoginInner() {
  return (
    <div className="admin-login-page">
      <div className="admin-login-bg" aria-hidden>
        <Image
          src={LOGIN_BG}
          alt=""
          fill
          className="admin-login-bg-image"
          sizes="100vw"
          priority
          quality={80}
        />
        <div className="admin-login-bg-veil" />
        <div className="admin-login-bg-accent" />
      </div>

      <div className="admin-login-page-inner">
        <div className="admin-login-shell">
          <div className="admin-login-brand-col">
            <div className="admin-login-logo-wrap">
              <Image
                src="/ftpr-admin-logo.svg"
                alt="FTPR Lions Academy"
                width={420}
                height={150}
                className="admin-login-logo-img"
                priority
              />
            </div>
            <p className="admin-login-brand-tagline">Football academy operations &amp; player management</p>
          </div>

          <div className="admin-login-form-col">
            <div className="admin-login-form-head">
              <h1 className="admin-login-form-title">Admin login</h1>
              <p className="admin-login-form-lead">Sign in with your administrator credentials.</p>
            </div>
            <AdminLoginForm />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<AdminLoginFallback />}>
      <AdminLoginInner />
    </Suspense>
  );
}
