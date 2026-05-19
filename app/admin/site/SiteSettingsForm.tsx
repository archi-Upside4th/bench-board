"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateSiteSettings, type SiteSettingsInput } from "@/lib/actions";

type Props = { initial: SiteSettingsInput };

const FIELDS: {
  group: string;
  items: { key: keyof SiteSettingsInput; label: string; hint?: string; multiline?: boolean; rows?: number }[];
}[] = [
  {
    group: "Header",
    items: [
      { key: "siteSubtitle", label: "Site subtitle (shown next to wordmark)" },
      { key: "githubUrl", label: "View on GitHub URL", hint: "Leave blank to hide the button." },
    ],
  },
  {
    group: "Hero",
    items: [
      { key: "heroEyebrow", label: "Eyebrow (small label above title)" },
      { key: "heroTitle", label: "Title (large heading)" },
      { key: "heroDescription", label: "Description paragraph", multiline: true, rows: 3, hint: "**bold** is rendered." },
    ],
  },
  {
    group: "Section ledes",
    items: [
      { key: "leaderboardLede", label: "Agent ranking lede", multiline: true, rows: 2 },
      { key: "paretoLede", label: "Pareto frontier lede", multiline: true, rows: 2 },
      { key: "fpLede", label: "FP rate lede", multiline: true, rows: 2 },
    ],
  },
  {
    group: "Pareto commentary",
    items: [
      { key: "paretoQuote", label: "Highlighted quote", multiline: true, rows: 2, hint: "**bold** rendered." },
      { key: "paretoBody", label: "Body paragraph", multiline: true, rows: 3, hint: "**bold** rendered." },
    ],
  },
  {
    group: "Methodology",
    items: [
      { key: "methodologyDetectGrader", label: "Detect grader description", multiline: true, rows: 2 },
      { key: "methodologyExploitGrader", label: "Exploit grader description", multiline: true, rows: 2 },
      { key: "citeBibtex", label: "BibTeX cite block", multiline: true, rows: 6 },
    ],
  },
  {
    group: "About",
    items: [
      { key: "aboutLede", label: "About lede paragraph", multiline: true, rows: 4 },
    ],
  },
  {
    group: "Footer",
    items: [
      { key: "footerCopyright", label: "Copyright line" },
    ],
  },
];

export function SiteSettingsForm({ initial }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<SiteSettingsInput>(initial);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function set<K extends keyof SiteSettingsInput>(key: K, v: SiteSettingsInput[K]) {
    setDraft((d) => ({ ...d, [key]: v }));
    setSaved(false);
  }

  function submit() {
    setErr(null);
    start(async () => {
      try {
        await updateSiteSettings(draft);
        setSaved(true);
        router.refresh();
        setTimeout(() => setSaved(false), 2500);
      } catch (e) {
        setErr((e as Error).message);
      }
    });
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);

  return (
    <div>
      {err ? <div className="adm-banner err" style={{ marginBottom: 16 }}>{err}</div> : null}
      {saved ? <div className="adm-banner ok" style={{ marginBottom: 16 }}>Saved.</div> : null}

      {FIELDS.map(({ group, items }) => (
        <section className="adm-section" key={group}>
          <h2 className="adm-h2">{group}</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 16 }}>
            {items.map(({ key, label, hint, multiline, rows }) => (
              <div className="adm-field" key={key}>
                <span className="adm-label">{label}</span>
                {multiline ? (
                  <textarea
                    className="adm-textarea"
                    value={(draft[key] as string) ?? ""}
                    onChange={(e) => set(key, e.target.value as SiteSettingsInput[typeof key])}
                    rows={rows ?? 3}
                    spellCheck={false}
                    style={{ resize: "vertical", lineHeight: 1.55, minHeight: 64 }}
                  />
                ) : (
                  <input
                    className="adm-input"
                    value={(draft[key] as string) ?? ""}
                    onChange={(e) => set(key, e.target.value as SiteSettingsInput[typeof key])}
                  />
                )}
                {hint ? <span className="adm-hint">{hint}</span> : null}
              </div>
            ))}
          </div>
        </section>
      ))}

      <section className="adm-section" style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <button className="primary-btn" type="button" onClick={submit} disabled={pending || !dirty}>
          {pending ? "Saving…" : dirty ? "Save changes" : "No changes"}
        </button>
        {dirty ? <span className="lede">You have unsaved changes.</span> : null}
      </section>
    </div>
  );
}
