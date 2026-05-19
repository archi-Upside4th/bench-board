"use client";
import { useEffect, useRef } from "react";
import { renderInline } from "@/lib/inline";

type Stat = { k: string; v: number; vSmall?: string; corner?: string; x: string };

type Props = {
  stats: Stat[];
  eyebrow: string;
  title: string;
  description: string;
};

export function Hero({ stats, eyebrow, title, description }: Props) {
  const heroRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cards = heroRef.current?.querySelectorAll<HTMLElement>(".stat") ?? [];
    const targets = heroRef.current?.querySelectorAll<HTMLElement>("[data-count]") ?? [];

    if (reduce) {
      cards.forEach((c) => c.classList.add("in"));
      targets.forEach((el) => {
        const t = Number(el.dataset.count ?? 0);
        el.textContent = String(t);
      });
      return;
    }

    requestAnimationFrame(() => cards.forEach((c) => c.classList.add("in")));

    const duration = 1200;
    const start = performance.now() + 400;
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);

    let raf = 0;
    const tick = (now: number) => {
      const t = Math.max(0, Math.min(1, (now - start) / duration));
      const k = ease(t);
      targets.forEach((el) => {
        const target = Number(el.dataset.count ?? 0);
        el.textContent = String(Math.round(target * k));
      });
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [stats]);

  return (
    <section className="first" ref={heroRef}>
      <div className="wrap">
        <div className="section-eyebrow" style={{ color: "var(--accent-hi)" }}>
          {eyebrow}
        </div>
        <h1 style={{ fontSize: 56, margin: "10px 0 0", letterSpacing: "-0.03em" }}>
          {title}
        </h1>
        <p className="lede" style={{ marginTop: 14, maxWidth: "64ch" }}>
          {renderInline(description)}
        </p>

        <div className="hero">
          {stats.map((s, i) => (
            <div className="stat" key={i}>
              {s.corner ? <span className="corner">{s.corner}</span> : null}
              <span className="k">{s.k}</span>
              <span className="v">
                <span data-count={s.v}>0</span>
                {s.vSmall ? <small>{s.vSmall}</small> : null}
              </span>
              <span className="x">{s.x}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
