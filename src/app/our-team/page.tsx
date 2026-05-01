import Image from "next/image";
import { getCachedSiteContent } from "@/lib/get-site-content-cached";

export const dynamic = "force-dynamic";

export default async function OurTeamPage() {
  const c = await getCachedSiteContent();

  return (
    <div className="container page-y">
      <section className="page-stack">
        <div className="card page-hero-card">
          <span className="k-pill">OUR TEAM</span>
          <h1 className="page-h1">{c.ourTeamPageTitle}</h1>
          <p className="page-lead muted">{c.ourTeamPageLead}</p>
        </div>
        <div className="k-three-col">
          {c.teamMembers.map((member) => (
            <article className="card" key={member.id}>
              <Image
                src={member.image}
                alt={member.name}
                width={1200}
                height={900}
                className="k-img"
                unoptimized={member.image.startsWith("/uploads/")}
              />
              <h3>{member.name}</h3>
              <p className="muted">{member.role}</p>
              {member.description ? (
                <p className="muted" style={{ whiteSpace: "pre-wrap", marginTop: "0.5rem" }}>
                  {member.description}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
