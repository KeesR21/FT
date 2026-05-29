"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { HomeTodayScheduleCard } from "@/components/kickstar/HomeTodayScheduleCard";
import { academyDateKey, millisecondsUntilAcademyMidnight } from "@/lib/weekly-schedule/academy-time";
import type { HomeScheduleBrief } from "@/lib/weekly-schedule/home-today-brief";

type Props = {
  brief: HomeScheduleBrief;
};

/**
 * Refreshes server data at each academy midnight (00:00 Africa/Kigali) so today's schedule updates.
 */
export function HomeTodayScheduleCardWithRefresh({ brief }: Props) {
  const router = useRouter();
  const dayKeyRef = useRef(brief.dayKey);

  useEffect(() => {
    dayKeyRef.current = brief.dayKey;
  }, [brief.dayKey]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const scheduleMidnightRefresh = () => {
      const delay = millisecondsUntilAcademyMidnight() + 500;
      timer = setTimeout(() => {
        const nowKey = academyDateKey(new Date());
        if (nowKey !== dayKeyRef.current) {
          router.refresh();
        } else {
          scheduleMidnightRefresh();
        }
      }, delay);
    };

    scheduleMidnightRefresh();

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      const nowKey = academyDateKey(new Date());
      if (nowKey !== dayKeyRef.current) {
        router.refresh();
      }
    };

    document.addEventListener("visibilitychange", onVisible);

    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);

  return <HomeTodayScheduleCard brief={brief} />;
}
