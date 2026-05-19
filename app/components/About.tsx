export function About({ title, lede }: { title: string; lede: string }) {
  return (
    <section>
      <div className="wrap">
        <div className="section-head">
          <div className="left">
            <div className="section-eyebrow">About</div>
            <h2>{title}</h2>
            <p className="lede">{lede}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
