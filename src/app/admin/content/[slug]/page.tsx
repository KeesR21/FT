"use client";

import clsx from "clsx";
import { useParams } from "next/navigation";
import type { ComponentType } from "react";
import { AboutEditor } from "../editors/about-editor";
import { ContactEditor } from "../editors/contact-editor";
import { GalleryEditor } from "../editors/gallery-editor";
import { HomeEditor } from "../editors/home-editor";
import { LocationEditor } from "../editors/location-editor";
import { NewsEditor } from "../editors/news-editor";
import { EventsEditor } from "../editors/events-editor";
import { ProgramsEditor } from "../editors/programs-editor";
import { ScheduleEditor } from "../editors/schedule-editor";
import { SiteEditor } from "../editors/site-editor";
import { TeamEditor } from "../editors/team-editor";

const MAP: Record<string, ComponentType> = {
  home: HomeEditor,
  about: AboutEditor,
  programs: ProgramsEditor,
  schedule: ScheduleEditor,
  "our-team": TeamEditor,
  news: NewsEditor,
  events: EventsEditor,
  gallery: GalleryEditor,
  contact: ContactEditor,
  location: LocationEditor,
  site: SiteEditor
};

export default function AdminContentSlugPage() {
  const params = useParams();
  const slug = typeof params?.slug === "string" ? params.slug : "";
  const C = MAP[slug];
  if (!C) {
    return (
      <div className="card">
        <p className="muted">Unknown content page.</p>
      </div>
    );
  }
  return (
    <div className={clsx("cms-editor-surface", "cms-editor-surface--wide")}>
      <C />
    </div>
  );
}
