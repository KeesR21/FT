import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { PUBLIC_EVENTS_PAGE_ENABLED } from "@/lib/site-features";

export default function EventsLayout({ children }: { children: ReactNode }) {
  if (!PUBLIC_EVENTS_PAGE_ENABLED) {
    redirect("/schedule");
  }
  return <>{children}</>;
}
