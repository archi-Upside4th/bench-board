"use client";

import { useState, useTransition } from "react";

type Props = {
  initial: number;
  fmt?: (v: number) => string;
  parse?: (s: string) => number;
  validate?: (v: number) => string | null;
  /**
   * Server action invoked as `action({ ...actionInput, value })`.
   * Must be a server action (declared in a "use server" module) so it can
   * cross the Server→Client component boundary. Typed loosely so any
   * action shape that accepts a `value` field works.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  action: (input: any) => Promise<void>;
  /** Plain serializable identifiers (runId, agentId, field, etc.) */
  actionInput: Record<string, unknown>;
  width?: number;
  align?: "left" | "right";
};

export function InlineCell({
  initial,
  fmt = (v) => String(v),
  parse = (s) => Number(s),
  validate,
  action,
  actionInput,
  width = 90,
  align = "right",
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(fmt(initial));
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function commit() {
    const parsed = parse(draft);
    if (Number.isNaN(parsed)) {
      setErr("not a number");
      return;
    }
    if (validate) {
      const e = validate(parsed);
      if (e) { setErr(e); return; }
    }
    if (parsed === value) {
      setEditing(false);
      setErr(null);
      return;
    }
    start(async () => {
      try {
        await action({ ...actionInput, value: parsed });
        setValue(parsed);
        setDraft(fmt(parsed));
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
          className={`adm-input num ${err ? "invalid" : ""}`}
          value={draft}
          onChange={(e) => { setDraft(e.target.value); setErr(null); }}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); commit(); }
            else if (e.key === "Escape") { setDraft(fmt(value)); setEditing(false); setErr(null); }
          }}
          style={{ width, padding: "4px 8px", fontSize: 12 }}
          inputMode="decimal"
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
        minWidth: width,
        textAlign: align,
        fontFamily: "var(--mono)",
        fontVariantNumeric: "tabular-nums",
        padding: "4px 8px",
        borderRadius: 4,
        cursor: "text",
        background: saved ? "rgba(52,211,153,0.10)" : "transparent",
        transition: "background 240ms",
        color: "var(--ink)",
      }}
    >
      {fmt(value)}
    </span>
  );
}
