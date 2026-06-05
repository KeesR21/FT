import Link from "next/link";
import { KickstarGlassCard } from "@/components/kickstar/GlassCard";
import type { HomeScheduleBrief } from "@/lib/weekly-schedule/home-today-brief";

type Props = {
  brief: HomeScheduleBrief;
};

export function HomeTodayScheduleCard({ brief }: Props) {
  return (
    <KickstarGlassCard className="ks-home-schedule-card">
      <h2 className="ks-glass-h">{brief.heading}</h2>
      <p className="ks-home-schedule-card__date muted">{brief.dateLabel}</p>

      {brief.isEmpty ? (
        <p className="ks-home-schedule-card__empty muted">{brief.emptyMessage}</p>
      ) : (
        <ul className="ks-home-schedule-card__list">
          {brief.items.map((item, index) => (
            <li
              key={`${item.timeLabel}-${item.title}-${index}`}
              className={`ks-home-schedule-card__item${item.completed ? " ks-home-schedule-card__item--completed" : ""}`}
            >
              <span className="ks-home-schedule-card__time">
                {item.timeLabel}
                {item.completed ? (
                  <span className="ks-home-schedule-card__completed">✓ Completed</span>
                ) : null}
              </span>
              <span className="ks-home-schedule-card__title">{item.title}</span>
              {item.meta ? <span className="ks-home-schedule-card__meta muted">{item.meta}</span> : null}
            </li>
          ))}
        </ul>
      )}

      <p className="ks-glass-link-row">
        <Link href="/schedule" className="ks-text-link">
          Full schedule →
        </Link>
      </p>
    </KickstarGlassCard>
  );
}
