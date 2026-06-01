import { SiteFooter } from "@/components/site-footer";
import Navbar from "@/components/navbar";
import { getCachedSiteContent } from "@/lib/get-site-content-cached";
import type { ReactNode } from "react";

/** Public site shell: navbar + footer content loaded from the database. */
export async function PublicChrome({ children }: { children: ReactNode }) {
  const content = await getCachedSiteContent();

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
