import "./globals.css";
import { PublicChrome } from "@/components/public-chrome";
import { Jost, Poppins } from "next/font/google";
import { headers } from "next/headers";
import type { Metadata } from "next";
import type { ReactNode } from "react";

const jost = Jost({
  subsets: ["latin"],
  variable: "--font-jost",
  display: "swap"
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap"
});

export const metadata: Metadata = {
  title: {
    default: "FTPR Lions Football Academy",
    template: "%s | FTPR Lions Football Academy"
  },
  description: "Professional football academy — registration, programs, and schedules",
  icons: {
    icon: [{ url: "/logo.jpeg", type: "image/jpeg" }],
    shortcut: "/logo.jpeg",
    apple: "/logo.jpeg"
  }
};

/** Required with `headers()` below — avoids static/partial prerender mismatches that can surface as HTTP 500 in some Next 15 setups. */
export const dynamic = "force-dynamic";

/** Async root layout keeps admin vs public chrome in one place (avoids an extra async child that can confuse Webpack Fast Refresh on Windows). */
export default async function RootLayout({ children }: { children: ReactNode }) {
  const h = await headers();
  const pathname = h.get("x-pathname") ?? "";
  const isAdmin = pathname.startsWith("/admin");
  const isPortal = pathname.startsWith("/portal");

  return (
    <html lang="en" className={`${jost.variable} ${poppins.variable}`}>
      <body className="antialiased">
        {isAdmin || isPortal ? (
          <main id="main-content" className={isAdmin ? "admin-outer-main" : "portal-outer-main"} tabIndex={-1}>
            {children}
          </main>
        ) : (
          <PublicChrome>{children}</PublicChrome>
        )}
      </body>
    </html>
  );
}
