"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateSiteSettings, type SiteSettingsInput } from "@/lib/actions";

type Props = { initial: SiteSettingsInput };

type Field = {
  key: keyof SiteSettingsInput;
  label: string;
  hint?: string;
  multiline?: boolean;
  rows?: number;
};

const GROUPS: { group: string; defaultOpen?: boolean; items: Field[] }[] = [
  {
    group: "Brand & header",
    defaultOpen: true,
    items: [
      { key: "brandLeft", label: "Brand — left half", hint: "Example: Bench" },
      { key: "brandRight", label: "Brand — right half", hint: "Example: Board" },
      { key: "siteSubtitle", label: "Site subtitle (next to wordmark)" },
      { key: "githubUrl", label: "View on GitHub URL", hint: "Leave blank to hide the button." },
    ],
  },
  {
    group: "Hero — top of page",
    defaultOpen: true,
    items: [
      { key: "heroEyebrow", label: "Eyebrow (small label above the title)" },
      { key: "heroTitle", label: "Title (large heading)" },
      { key: "heroDescription", label: "Description paragraph", multiline: true, rows: 3, hint: "**bold** is rendered." },
      { key: "heroStat1Label", label: "Stat card 1 label" },
      { key: "heroStat2Label", label: "Stat card 2 label" },
      { key: "heroStat3Label", label: "Stat card 3 label" },
      { key: "heroStat4Label", label: "Stat card 4 label" },
    ],
  },
  {
    group: "Agent ranking section",
    items: [
      { key: "leaderboardTitle", label: "Section title" },
      { key: "leaderboardLede", label: "Section description", multiline: true, rows: 2 },
    ],
  },
  {
    group: "Pareto / cost-vs-accuracy section",
    items: [
      { key: "paretoTitle", label: "Section title" },
      { key: "paretoLede", label: "Section description", multiline: true, rows: 2 },
      { key: "paretoQuote", label: "Highlighted quote", multiline: true, rows: 2, hint: "**bold** rendered." },
      { key: "paretoBody", label: "Body paragraph", multiline: true, rows: 3, hint: "**bold** rendered." },
    ],
  },
  {
    group: "False-positive section",
    items: [
      { key: "fpTitle", label: "Section title" },
      { key: "fpLede", label: "Section description", multiline: true, rows: 2 },
    ],
  },
  {
    group: "Methodology section",
    items: [
      { key: "methodologyTitle", label: "Section title" },
      { key: "methodologyDetectGrader", label: "Detect grader description", multiline: true, rows: 2 },
      { key: "methodologyExploitGrader", label: "Exploit grader description", multiline: true, rows: 2 },
      { key: "citeBibtex", label: "BibTeX cite block", multiline: true, rows: 6 },
    ],
  },
  {
    group: "About section",
    items: [
      { key: "aboutTitle", label: "Section title" },
      { key: "aboutLede", label: "Body paragraph", multiline: true, rows: 4 },
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
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(GROUPS.map((g) => [g.group, g.defaultOpen ?? false]))
  );

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

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 24 }}>
        {GROUPS.map(({ group, items }) => {
          const open = openGroups[group];
          return (
            <div key={group} style={{ border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden" }}>
              <button
                type="button"
                onClick={() => setOpenGroups((s) => ({ ...s, [group]: !s[group] }))}
                style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "14px 18px", background: open ? "var(--bg-card-hover)" : "var(--bg-card)",
                  border: 0, color: "var(--ink)", cursor: "pointer", fontSize: 14, fontWeight: 600,
                  fontFamily: "var(--sans)", textAlign: "left",
                  transition: "background 120ms",
                }}
              >
                <span>{group}</span>
                <span style={{ color: "var(--mute)", fontSize: 12, fontFamily: "var(--mono)" }}>
                  {items.length} field{items.length === 1 ? "" : "s"} · {open ? "▾" : "▸"}
                </span>
              </button>
              {open ? (
                <div style={{ padding: "18px 18px 22px", display: "flex", flexDirection: "column", gap: 16, background: "var(--bg)" }}>
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
              ) : null}
            </div>
          );
        })}
      </div>

      <div
        style={{
          position: "sticky", bottom: 0, marginTop: 24,
          padding: "16px 0", background: "linear-gradient(180deg, transparent, var(--bg) 30%)",
          display: "flex", gap: 12, alignItems: "center",
        }}
      >
        <button className="primary-btn" type="button" onClick={submit} disabled={pending || !dirty}>
          {pending ? "Saving…" : dirty ? "Save all changes" : "No changes"}
        </button>
        {dirty ? <span className="lede">You have unsaved changes.</span> : null}
      </div>
    </div>
  );
}
