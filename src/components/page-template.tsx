export default function PageTemplate({
  title,
  intro,
  items
}: {
  title: string;
  intro: string;
  items: string[];
}) {
  return (
    <div className="container page-y">
      <section className="page-stack">
        <div className="card page-hero-card">
          <h1 className="page-h1">{title}</h1>
          <p className="page-lead muted">{intro}</p>
        </div>
        <div className="template-card-grid">
          {items.map((item) => (
            <article className="card" key={item}>
              <strong>{item}</strong>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
