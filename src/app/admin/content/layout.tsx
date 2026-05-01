"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { CMS_PAGE_LINKS, cmsAdminPath } from "@/lib/cms-nav";

export default function AdminContentLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";

  return (
    <div className="admin-cms-layout">
      <aside className="card admin-cms-subnav" aria-label="Choose page to edit">
        <p className="admin-nav-group-label" style={{ marginBottom: "0.35rem" }}>
          Page editor
        </p>
        <p className="admin-cms-subnav-hint">Pick a public page. Changes apply after you save in each editor.</p>
        <div className="admin-cms-subnav-links">
          {CMS_PAGE_LINKS.map((p) => {
            const href = cmsAdminPath(p.slug);
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link key={p.slug} href={href} className={clsx("admin-cms-subnav-link", active && "admin-cms-subnav-link--active")}>
                {p.label}
              </Link>
            );
          })}
        </div>
      </aside>
      <div className="cms-editor-main">{children}</div>
    </div>
  );
}
