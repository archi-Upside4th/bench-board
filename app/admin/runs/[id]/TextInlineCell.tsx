"use client";

import { useState, useTransition } from "react";

type Props = {
  initial: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  action: (input: any) => Promise<void>;
  actionInput: Record<string, unknown>;
  width?: number | string;
  placeholder?: string;
};

export function TextInlineCell({ initial, action, actionInput, width = 240, placeholder }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initial);
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function commit() {
    const trimmed = draft.trim();
    if (!trimmed) { setErr("required"); return; }
    if (trimmed === value) {
      setEditing(false); setErr(null); return;
    }
    start(async () => {
      try {
        await action({ ...actionInput, value: trimmed });
        setValue(trimmed);
        setDraft(trimmed);
        setEditing(false);
        setErr(null);
        setSaved(true);
        setTimeout(() => setSaved(false), 1400);
      } catch (e) {
        setErr((e as Error).message);
      }
    });
  }

  if (editing) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <input
          autoFocus
          className={`adm-input ${err ? "invalid" : ""}`}
          value={draft}
          onChange={(e) => { setDraft(e.target.value); setErr(null); }}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); commit(); }
            else if (e.key === "Escape") { setDraft(value); setEditing(false); setErr(null); }
          }}
          placeholder={placeholder}
          style={{ width, padding: "4px 8px", fontSize: 12.5, fontFamily: "var(--mono)" }}
          disabled={pending}
        />
        {err ? <span style={{ color: "var(--bad)", fontSize: 10 }}>{err}</span> : null}
      </span>
    );
  }

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={() => setEditing(true)}
      onKeyDown={(e) => { if (e.key === "Enter") setEditing(true); }}
      title="Click to edit"
      style={{
        display: "inline-block",
        padding: "2px 6px",
        borderRadius: 4,
        cursor: "text",
        background: saved ? "rgba(52,211,153,0.10)" : "transparent",
        transition: "background 240ms",
        color: "var(--ink)",
        fontFamily: "var(--mono)",
      }}
    >
      {value}
    </span>
  );
}
