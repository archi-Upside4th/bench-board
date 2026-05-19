"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Agent } from "@/db/schema";

type AddAction = (input: { runId: number; agentId: string }) => Promise<void>;
type DeleteAction = (input: { runId: number; agentId: string }) => Promise<void>;

/* ---------- Delete one row ---------- */

export function DeleteRowButton({
  runId,
  agentId,
  action,
  label = "Delete",
  confirmText,
}: {
  runId: number;
  agentId: string;
  action: DeleteAction;
  label?: string;
  confirmText?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  function onClick() {
    if (confirmText && !confirm(confirmText)) return;
    start(async () => {
      await action({ runId, agentId });
      router.refresh();
    });
  }
  return (
    <button
      type="button"
      className="ghost-btn"
      onClick={onClick}
      disabled={pending}
      style={{ height: 26, padding: "0 8px", fontSize: 11, color: "var(--bad)" }}
      title={`Delete ${agentId}`}
    >
      {label}
    </button>
  );
}

/* ---------- Add row picker ---------- */

export function AddRowPicker({
  runId,
  available,
  action,
  label = "+ Add agent",
}: {
  runId: number;
  /** agents not yet in this table */
  available: Agent[];
  action: AddAction;
  label?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);

  if (available.length === 0) return null;

  function add(agentId: string) {
    start(async () => {
      await action({ runId, agentId });
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div style={{ position: "relative", display: "inline-block", marginTop: 12 }}>
      <button type="button" className="ghost-btn" onClick={() => setOpen((v) => !v)} disabled={pending}>
        {pending ? "Adding…" : label}
      </button>
      {open ? (
        <div
          style={{
            position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 10,
            background: "var(--bg-card)", border: "1px solid var(--line)",
            borderRadius: 8, padding: 6, minWidth: 240,
            boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
            maxHeight: 320, overflowY: "auto",
          }}
        >
          {available.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => add(a.id)}
              disabled={pending}
              style={{
                display: "flex", alignItems: "center", gap: 8, width: "100%",
                padding: "8px 10px", border: 0, background: "transparent",
                color: "var(--ink)", textAlign: "left", cursor: "pointer",
                borderRadius: 6, fontSize: 12.5, fontFamily: "var(--mono)",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--bg-card-hover)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              <span className="agent-swatch" style={{ background: a.color }} />
              <span style={{ flex: 1 }}>{a.id}</span>
              <span style={{ color: "var(--mute)", fontSize: 11 }}>{a.vendor}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ---------- Add FP category ---------- */

export function AddCategoryControl({
  runId,
  action,
}: {
  runId: number;
  action: (input: { runId: number; category: string }) => Promise<void>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) { setErr("name required"); return; }
    setErr(null);
    start(async () => {
      try {
        await action({ runId, category: trimmed });
        setName("");
        router.refresh();
      } catch (e) {
        setErr((e as Error).message);
      }
    });
  }

  return (
    <div className="adm-row" style={{ marginTop: 12 }}>
      <input
        className="adm-input"
        placeholder="New category name…"
        value={name}
        onChange={(e) => { setName(e.target.value); setErr(null); }}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
        style={{ width: 240 }}
      />
      <button type="button" className="ghost-btn" onClick={submit} disabled={pending}>
        {pending ? "Adding…" : "+ Add category"}
      </button>
      {err ? <span style={{ color: "var(--bad)", fontSize: 11 }}>{err}</span> : null}
    </div>
  );
}

/* ---------- Delete FP category ---------- */

export function DeleteCategoryButton({
  runId,
  category,
  action,
}: {
  runId: number;
  category: string;
  action: (input: { runId: number; category: string }) => Promise<void>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  function onClick() {
    if (!confirm(`Delete category "${category}" from this run? All agents' rates for it will be removed.`)) return;
    start(async () => {
      await action({ runId, category });
      router.refresh();
    });
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      title={`Remove ${category}`}
      style={{
        background: "transparent", border: 0, color: "var(--mute-2)",
        cursor: "pointer", padding: "0 4px", fontSize: 12, lineHeight: 1,
      }}
    >
      ×
    </button>
  );
}
