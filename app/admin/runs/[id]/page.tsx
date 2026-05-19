import { db } from "@/db";
import {
  agents,
  evalRuns,
  detectResults,
  exploitResults,
  fpRates,
} from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { InlineCell } from "./InlineCell";
import { RunActions } from "./RunActions";
import {
  updateDetectCell,
  updateExploitCell,
  updateFpCell,
} from "@/lib/actions";

export const dynamic = "force-dynamic";

type PageParams = { params: Promise<{ id: string }> };

export default async function RunDetailPage({ params }: PageParams) {
  const { id } = await params;
  const runId = Number(id);
  if (!Number.isFinite(runId)) notFound();

  const [run] = await db.select().from(evalRuns).where(eq(evalRuns.id, runId)).limit(1);
  if (!run) notFound();

  const [agentRows, detect, exploit, fps] = await Promise.all([
    db.select().from(agents).orderBy(asc(agents.id)),
    db
      .select()
      .from(detectResults)
      .where(eq(detectResults.runId, runId)),
    db
      .select()
      .from(exploitResults)
      .where(eq(exploitResults.runId, runId)),
    db.select().from(fpRates).where(eq(fpRates.runId, runId)),
  ]);

  const agentById = new Map(agentRows.map((a) => [a.id, a]));
  const detectSorted = [...detect].sort((a, b) => b.f1 - a.f1);
  const exploitSorted = [...exploit].sort((a, b) => b.success - a.success);

  const fpCategories = Array.from(new Set(fps.map((f) => f.category)));
  const fpByAgent = new Map<string, Map<string, number>>();
  for (const r of fps) {
    if (!fpByAgent.has(r.agentId)) fpByAgent.set(r.agentId, new Map());
    fpByAgent.get(r.agentId)!.set(r.category, r.rate);
  }
  const fpAgentIds = Array.from(fpByAgent.keys());

  const fmt2 = (v: number) => v.toFixed(2);
  const fmt0 = (v: number) => String(Math.round(v));
  const fmtMoney = (v: number) => "$" + v.toFixed(2);

  return (
    <div className="wrap adm-wrap" style={{ maxWidth: 1280 }}>
      <div className="adm-row between" style={{ marginBottom: 8 }}>
        <Link href="/admin" className="lede" style={{ fontSize: 12 }}>← Back to dashboard</Link>
        <RunActions runId={run.id} isPublic={run.isPublic} />
      </div>

      <div className="adm-row" style={{ gap: 12, marginTop: 8 }}>
        <h1 className="adm-h1">{run.version}</h1>
        <span className={`adm-status ${run.isPublic ? "public" : "hidden"}`}>
          {run.isPublic ? "public" : "hidden"}
        </span>
      </div>
      <p className="lede" style={{ marginTop: 8 }}>
        <span className="mono">{run.runId}</span> · created {new Date(run.createdAt).toISOString().slice(0, 10)}
        {" "}· judge <span className="mono">{run.judgeModel}</span>
      </p>

      <section className="adm-section">
        <h2 className="adm-h2">Detect mode ({detect.length})</h2>
        {detect.length === 0 ? (
          <p className="lede" style={{ marginTop: 12 }}>No detect results saved for this run.</p>
        ) : (
          <div style={{ overflowX: "auto", marginTop: 16 }}>
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Agent</th>
                  <th className="num">Precision</th>
                  <th className="num">Recall</th>
                  <th className="num">F1</th>
                  <th className="num">CI low</th>
                  <th className="num">CI high</th>
                  <th className="num">$ / task</th>
                  <th className="num">N tasks</th>
                </tr>
              </thead>
              <tbody>
                {detectSorted.map((r, i) => {
                  const a = agentById.get(r.agentId);
                  const base = { runId, agentId: r.agentId } as const;
                  return (
                    <tr key={r.agentId}>
                      <td className="rank-col">{String(i + 1).padStart(2, "0")}</td>
                      <td>
                        <div className="agent-cell">
                          <span className="agent-swatch" style={{ background: a?.color }} />
                          <span className="agent-name">{r.agentId}</span>
                        </div>
                      </td>
                      <td className="num"><InlineCell initial={r.precision} fmt={fmt2} action={updateDetectCell} actionInput={{ ...base, field: "precision" }} /></td>
                      <td className="num"><InlineCell initial={r.recall} fmt={fmt2} action={updateDetectCell} actionInput={{ ...base, field: "recall" }} /></td>
                      <td className="num"><InlineCell initial={r.f1} fmt={fmt2} action={updateDetectCell} actionInput={{ ...base, field: "f1" }} /></td>
                      <td className="num"><InlineCell initial={r.f1CiLow} fmt={fmt2} action={updateDetectCell} actionInput={{ ...base, field: "f1CiLow" }} /></td>
                      <td className="num"><InlineCell initial={r.f1CiHigh} fmt={fmt2} action={updateDetectCell} actionInput={{ ...base, field: "f1CiHigh" }} /></td>
                      <td className="num"><InlineCell initial={r.costUsdPerTask} fmt={fmtMoney} parse={(s) => Number(s.replace("$", ""))} action={updateDetectCell} actionInput={{ ...base, field: "costUsdPerTask" }} /></td>
                      <td className="num"><InlineCell initial={r.nTasks} fmt={fmt0} action={updateDetectCell} actionInput={{ ...base, field: "nTasks" }} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="adm-section">
        <h2 className="adm-h2">Exploit mode ({exploit.length})</h2>
        {exploit.length === 0 ? (
          <p className="lede" style={{ marginTop: 12 }}>No exploit results.</p>
        ) : (
          <div style={{ overflowX: "auto", marginTop: 16 }}>
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Agent</th>
                  <th className="num">Success</th>
                  <th className="num">Partial</th>
                  <th className="num">Fail</th>
                  <th className="num">$ / task</th>
                  <th className="num">N tasks</th>
                </tr>
              </thead>
              <tbody>
                {exploitSorted.map((r, i) => {
                  const a = agentById.get(r.agentId);
                  const base = { runId, agentId: r.agentId } as const;
                  return (
                    <tr key={r.agentId}>
                      <td className="rank-col">{String(i + 1).padStart(2, "0")}</td>
                      <td>
                        <div className="agent-cell">
                          <span className="agent-swatch" style={{ background: a?.color }} />
                          <span className="agent-name">{r.agentId}</span>
                        </div>
                      </td>
                      <td className="num"><InlineCell initial={r.success} fmt={fmt2} action={updateExploitCell} actionInput={{ ...base, field: "success" }} /></td>
                      <td className="num"><InlineCell initial={r.partial} fmt={fmt2} action={updateExploitCell} actionInput={{ ...base, field: "partial" }} /></td>
                      <td className="num"><InlineCell initial={r.fail} fmt={fmt2} action={updateExploitCell} actionInput={{ ...base, field: "fail" }} /></td>
                      <td className="num"><InlineCell initial={r.costUsdPerTask} fmt={fmtMoney} parse={(s) => Number(s.replace("$", ""))} action={updateExploitCell} actionInput={{ ...base, field: "costUsdPerTask" }} /></td>
                      <td className="num"><InlineCell initial={r.nTasks} fmt={fmt0} action={updateExploitCell} actionInput={{ ...base, field: "nTasks" }} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="adm-section">
        <h2 className="adm-h2">False positives ({fps.length} cells)</h2>
        {fps.length === 0 ? (
          <p className="lede" style={{ marginTop: 12 }}>No FP rates saved.</p>
        ) : (
          <div style={{ overflowX: "auto", marginTop: 16 }}>
            <table className="adm-table">
              <thead>
                <tr>
                  <th style={{ width: 180 }}>Agent</th>
                  {fpCategories.map((c) => (
                    <th key={c} className="num" style={{ fontFamily: "var(--mono)", fontSize: 10, textTransform: "none", letterSpacing: 0, color: "var(--ink-2)" }}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fpAgentIds.map((agentId) => {
                  const a = agentById.get(agentId);
                  const rates = fpByAgent.get(agentId)!;
                  return (
                    <tr key={agentId}>
                      <td>
                        <div className="agent-cell">
                          <span className="agent-swatch" style={{ background: a?.color }} />
                          <span className="agent-name">{agentId}</span>
                        </div>
                      </td>
                      {fpCategories.map((c) => {
                        const v = rates.get(c) ?? 0;
                        return (
                          <td key={c} className="num">
                            <InlineCell
                              initial={v}
                              fmt={fmt2}
                              validate={(x) => (x < 0 || x > 1 ? "0–1 only" : null)}
                              action={updateFpCell}
                              actionInput={{ runId, agentId, category: c }}
                              width={64}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
