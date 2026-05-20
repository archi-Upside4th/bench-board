"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Agent, DetectResult, ExploitResult } from "@/db/schema";
import { InlineCell } from "./InlineCell";
import { AddRowPicker, DeleteRowButton } from "./RowCrudControls";
import {
  updateDetectCell,
  updateExploitCell,
  updateDetectCiHalf,
  addDetectRow,
  deleteDetectRow,
  addExploitRow,
  deleteExploitRow,
} from "@/lib/actions";

type Props = {
  runId: number;
  agents: Agent[];
  detect: DetectResult[];
  exploit: ExploitResult[];
};

export function EditableLeaderboard({ runId, agents, detect, exploit }: Props) {
  const [mode, setMode] = useState<"detect" | "exploit">("detect");
  const byId = useMemo(() => new Map(agents.map((a) => [a.id, a])), [agents]);

  const detectSorted = useMemo(
    () => [...detect].sort((a, b) => b.f1 - a.f1),
    [detect]
  );
  const exploitSorted = useMemo(
    () => [...exploit].sort((a, b) => b.success - a.success),
    [exploit]
  );

  // Tab slider (same pattern as public)
  const tabsRef = useRef<HTMLDivElement | null>(null);
  const detectBtnRef = useRef<HTMLButtonElement | null>(null);
  const exploitBtnRef = useRef<HTMLButtonElement | null>(null);
  const [indicator, setIndicator] = useState<{ x: number; w: number; ready: boolean }>({ x: 0, w: 0, ready: false });
  const measure = () => {
    const target = mode === "detect" ? detectBtnRef.current : exploitBtnRef.current;
    if (!target) return;
    setIndicator({ x: target.offsetLeft, w: target.offsetWidth, ready: true });
  };
  useLayoutEffect(measure, [mode]);
  useEffect(() => {
    const ro = new ResizeObserver(measure);
    if (tabsRef.current) ro.observe(tabsRef.current);
    if (detectBtnRef.current) ro.observe(detectBtnRef.current);
    if (exploitBtnRef.current) ro.observe(exploitBtnRef.current);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const detectAgentIds = useMemo(() => new Set(detect.map((d) => d.agentId)), [detect]);
  const exploitAgentIds = useMemo(() => new Set(exploit.map((e) => e.agentId)), [exploit]);
  const availableForDetect = agents.filter((a) => !detectAgentIds.has(a.id));
  const availableForExploit = agents.filter((a) => !exploitAgentIds.has(a.id));

  return (
    <section>
      <div className="section-head">
        <div className="left">
          <div className="section-eyebrow">Main results — editable</div>
          <h2 style={{ fontSize: 22 }}>Agent ranking</h2>
          <p className="lede">
            Click any value to edit. Hover a row for the delete button.
          </p>
        </div>
        <div className="tabs has-slider" role="tablist" ref={tabsRef}>
          <span
            className="tab-slider"
            aria-hidden="true"
            style={{
              transform: `translateX(${indicator.x}px)`,
              width: indicator.w,
              opacity: indicator.ready ? 1 : 0,
            }}
          />
          <button
            ref={detectBtnRef}
            className="tab"
            role="tab"
            aria-selected={mode === "detect"}
            onClick={() => setMode("detect")}
          >
            Detect <span className="count">{detect.length}</span>
          </button>
          <button
            ref={exploitBtnRef}
            className="tab"
            role="tab"
            aria-selected={mode === "exploit"}
            onClick={() => setMode("exploit")}
          >
            Exploit <span className="count">{exploit.length}</span>
          </button>
        </div>
      </div>

      <div className="lb-card">
        <div className="lb-scroll">
          {mode === "detect" ? (
            <DetectTable
              runId={runId}
              rows={detectSorted}
              byId={byId}
            />
          ) : (
            <ExploitTable
              runId={runId}
              rows={exploitSorted}
              byId={byId}
            />
          )}
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        {mode === "detect" ? (
          <AddRowPicker runId={runId} available={availableForDetect} action={addDetectRow} />
        ) : (
          <AddRowPicker runId={runId} available={availableForExploit} action={addExploitRow} />
        )}
      </div>
    </section>
  );
}

/* ---------- Detect (matches public columns: Rank, Agent, Vendor, F1 ±CI + bar, Precision, Recall, $/task) ---------- */

function DetectTable({
  runId,
  rows,
  byId,
}: {
  runId: number;
  rows: DetectResult[];
  byId: Map<string, Agent>;
}) {
  const router = useRouter();
  const fmt2 = (v: number) => v.toFixed(2);
  const fmtMoney = (v: number) => "$" + v.toFixed(2);

  return (
    <table className="lb">
      <thead>
        <tr>
          <th>Rank</th>
          <th>Model</th>
          <th>Vendor</th>
          <th>F1 (95% CI)</th>
          <th className="num">Precision</th>
          <th className="num">Recall</th>
          <th className="num">$/task</th>
          <th className="num">Latency</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const a = byId.get(r.agentId);
          const base = { runId, agentId: r.agentId } as const;
          const ciHalf = (r.f1CiHigh - r.f1CiLow) / 2;
          return (
            <tr key={r.agentId} className={i === 0 ? "top" : ""}>
              <td className="rank-col">{String(i + 1).padStart(2, "0")}</td>
              <td>
                <div className="agent-cell">
                  <span className="agent-swatch" style={{ background: a?.color }} />
                  <span className="agent-name">{r.agentId}</span>
                </div>
              </td>
              <td className="vendor">{a?.vendor}</td>
              <td className="num-col">
                <InlineCell
                  initial={r.f1}
                  fmt={fmt2}
                  validate={(x) => (x < 0 || x > 1 ? "0–1" : null)}
                  action={updateDetectCell}
                  actionInput={{ ...base, field: "f1" }}
                  width={56}
                  align="left"
                />
                <span className="ci" style={{ marginLeft: 4 }}>
                  ±
                  <InlineCell
                    initial={ciHalf}
                    fmt={(v) => v.toFixed(2)}
                    validate={(x) => (x < 0 || x > 1 ? "0–1" : null)}
                    action={async (i) => {
                      await updateDetectCiHalf(i as { runId: number; agentId: string; value: number });
                      router.refresh();
                    }}
                    actionInput={base}
                    width={48}
                    align="left"
                  />
                </span>
                <span className="bar-inline">
                  <i style={{ width: `${Math.round(r.f1 * 100)}%` }} />
                </span>
              </td>
              <td className="num">
                <InlineCell
                  initial={r.precision}
                  fmt={fmt2}
                  validate={(x) => (x < 0 || x > 1 ? "0–1" : null)}
                  action={updateDetectCell}
                  actionInput={{ ...base, field: "precision" }}
                  width={56}
                />
              </td>
              <td className="num">
                <InlineCell
                  initial={r.recall}
                  fmt={fmt2}
                  validate={(x) => (x < 0 || x > 1 ? "0–1" : null)}
                  action={updateDetectCell}
                  actionInput={{ ...base, field: "recall" }}
                  width={56}
                />
              </td>
              <td className="num">
                <InlineCell
                  initial={r.costUsdPerTask}
                  fmt={fmtMoney}
                  parse={(s) => Number(s.replace("$", ""))}
                  action={updateDetectCell}
                  actionInput={{ ...base, field: "costUsdPerTask" }}
                  width={70}
                />
              </td>
              <td className="num">
                <InlineCell
                  initial={r.latencySecPerTask ?? 0}
                  fmt={(v) => v.toFixed(1) + "s"}
                  parse={(s) => Number(s.replace(/s$/, ""))}
                  action={updateDetectCell}
                  actionInput={{ ...base, field: "latencySecPerTask" }}
                  width={70}
                />
              </td>
              <td>
                <DeleteRowButton
                  runId={runId}
                  agentId={r.agentId}
                  action={deleteDetectRow}
                  confirmText={`Remove ${r.agentId} from Detect for this run?`}
                />
              </td>
            </tr>
          );
        })}
        {rows.length === 0 ? (
          <tr><td colSpan={9} style={{ padding: 20, color: "var(--mute)", fontSize: 13 }}>No detect results yet — add an agent below.</td></tr>
        ) : null}
      </tbody>
    </table>
  );
}

/* ---------- Exploit (matches public: Rank, Agent, Vendor, Outcome bar, Success, Partial, Fail, $/task) ---------- */

function ExploitTable({
  runId,
  rows,
  byId,
}: {
  runId: number;
  rows: ExploitResult[];
  byId: Map<string, Agent>;
}) {
  const fmt2 = (v: number) => v.toFixed(2);
  const pct = (v: number) => (v * 100).toFixed(0) + "%";
  const fmtMoney = (v: number) => "$" + v.toFixed(2);
  const fromPct = (s: string) => Number(s.replace("%", "")) / 100;

  return (
    <table className="lb">
      <thead>
        <tr>
          <th>Rank</th>
          <th>Model</th>
          <th>Vendor</th>
          <th>Outcome</th>
          <th className="num">Success</th>
          <th className="num">Partial</th>
          <th className="num">Fail</th>
          <th className="num">$/task</th>
          <th className="num">Latency</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const a = byId.get(r.agentId);
          const base = { runId, agentId: r.agentId } as const;
          return (
            <tr key={r.agentId} className={i === 0 ? "top" : ""}>
              <td className="rank-col">{String(i + 1).padStart(2, "0")}</td>
              <td>
                <div className="agent-cell">
                  <span className="agent-swatch" style={{ background: a?.color }} />
                  <span className="agent-name">{r.agentId}</span>
                </div>
              </td>
              <td className="vendor">{a?.vendor}</td>
              <td>
                <span className="seg" aria-hidden="true">
                  <i className="s-good" style={{ width: `${r.success * 100}%` }} />
                  <i className="s-warn" style={{ width: `${r.partial * 100}%` }} />
                  <i className="s-bad" style={{ width: `${r.fail * 100}%` }} />
                </span>
              </td>
              <td className="num cell-good">
                <InlineCell
                  initial={r.success}
                  fmt={pct}
                  parse={fromPct}
                  validate={(x) => (x < 0 || x > 1 ? "0–1" : null)}
                  action={updateExploitCell}
                  actionInput={{ ...base, field: "success" }}
                  width={56}
                />
              </td>
              <td className="num cell-warn">
                <InlineCell
                  initial={r.partial}
                  fmt={pct}
                  parse={fromPct}
                  validate={(x) => (x < 0 || x > 1 ? "0–1" : null)}
                  action={updateExploitCell}
                  actionInput={{ ...base, field: "partial" }}
                  width={56}
                />
              </td>
              <td className="num cell-bad">
                <InlineCell
                  initial={r.fail}
                  fmt={pct}
                  parse={fromPct}
                  validate={(x) => (x < 0 || x > 1 ? "0–1" : null)}
                  action={updateExploitCell}
                  actionInput={{ ...base, field: "fail" }}
                  width={56}
                />
              </td>
              <td className="num">
                <InlineCell
                  initial={r.costUsdPerTask}
                  fmt={fmtMoney}
                  parse={(s) => Number(s.replace("$", ""))}
                  action={updateExploitCell}
                  actionInput={{ ...base, field: "costUsdPerTask" }}
                  width={70}
                />
              </td>
              <td className="num">
                <InlineCell
                  initial={r.latencySecPerTask ?? 0}
                  fmt={(v) => v.toFixed(1) + "s"}
                  parse={(s) => Number(s.replace(/s$/, ""))}
                  action={updateExploitCell}
                  actionInput={{ ...base, field: "latencySecPerTask" }}
                  width={70}
                />
              </td>
              <td>
                <DeleteRowButton
                  runId={runId}
                  agentId={r.agentId}
                  action={deleteExploitRow}
                  confirmText={`Remove ${r.agentId} from Exploit for this run?`}
                />
              </td>
            </tr>
          );
        })}
        {rows.length === 0 ? (
          <tr><td colSpan={10} style={{ padding: 20, color: "var(--mute)", fontSize: 13 }}>No exploit results yet — add an agent below.</td></tr>
        ) : null}
      </tbody>
    </table>
  );
}

