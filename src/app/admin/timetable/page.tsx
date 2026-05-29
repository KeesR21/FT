"use client";

import { AdminWeeklySchedule } from "@/components/admin/AdminWeeklySchedule";

export const dynamic = "force-dynamic";

export default function AdminTimetablePage() {
  return (
    <section className="page-stack">
      <AdminWeeklySchedule />
    </section>
  );
}
