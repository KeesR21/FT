"use client";

import { AdminTimetableCalendar } from "@/components/admin/AdminTimetableCalendar";

export default function AdminTimetablePage() {
  return (
    <section className="page-stack">
      <div className="card page-hero-card">
        <span className="k-pill">SCHEDULE</span>
        <h1 className="page-h1">Timetable management</h1>
        <p className="page-lead muted">
          Use the week grid to pick date and start time — no typing. Duration or end time is chosen from dropdowns. Past
          slots are blocked on save (server and browser).
        </p>
      </div>

      <AdminTimetableCalendar />
    </section>
  );
}
