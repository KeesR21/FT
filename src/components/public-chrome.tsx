import { SiteFooter } from "@/components/site-footer";
import Navbar from "@/components/navbar";
import { buildDefaultSiteContent } from "@/lib/default-site-content";
import { getCachedSiteContent } from "@/lib/get-site-content-cached";
import type { ReactNode } from "react";

/** Public site shell: navbar + footer content loaded from the database. */
export async function PublicChrome({ children }: { children: ReactNode }) {
  const defaults = buildDefaultSiteContent();
  let content = defaults;
  try {
    const loaded = await getCachedSiteContent();
    content = {
      ...defaults,
      ...loaded,
      footerContent: loaded.footerContent ?? defaults.footerContent,
      contactInfo: loaded.contactInfo ?? defaults.contactInfo
    };
  } catch {
    // Non-fatal — render with defaults so pages never hard-crash
  }

  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <Navbar />
      <main id="main-content" className="main-wrap" tabIndex={-1}>
        {children}
      </main>
      <SiteFooter footer={content.footerContent} contact={content.contactInfo} />
    </>
  );
}
