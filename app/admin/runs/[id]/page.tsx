import { db } from "@/db";
import {
  agents,
  evalRuns,
  detectResults,
  exploitResults,
  fpRates,
  reasoningPoints,
  customAgents,
  customAgentResults,
  customAgentExploitResults,
  customAgentFpRates,
} from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { TextInlineCell } from "./TextInlineCell";
import { RunMetaIntCell } from "./RunMetaCell";
import { RunActions } from "./RunActions";
import { EditableLeaderboard } from "./EditableLeaderboard";
import { EditableAgentRanking } from "./EditableAgentRanking";
import { EditableFpTable } from "./EditableFpTable";
import { EditableReasoningTable } from "./EditableReasoningTable";
import { updateRunMetaText } from "@/lib/actions";

export const dynamic = "force-dynamic";

type PageParams = { params: Promise<{ id: string }> };

export default async function RunDetailPage({ params }: PageParams) {
  const { id } = await params;
  const runId = Number(id);
  if (!Number.isFinite(runId)) notFound();

  const [run] = await db.select().from(evalRuns).where(eq(evalRuns.id, runId)).limit(1);
  if (!run) notFound();

  const [
    agentRows,
    detect,
    exploit,
    fps,
    reasoning,
    customAgentRows,
    customResults,
    customExploit,
    customFps,
  ] = await Promise.all([
    db.select().from(agents).orderBy(asc(agents.id)),
    db.select().from(detectResults).where(eq(detectResults.runId, runId)),
    db.select().from(exploitResults).where(eq(exploitResults.runId, runId)),
    db.select().from(fpRates).where(eq(fpRates.runId, runId)),
    db.select().from(reasoningPoints).where(eq(reasoningPoints.runId, runId)),
    db.select().from(customAgents).orderBy(asc(customAgents.id)),
    db.select().from(customAgentResults).where(eq(customAgentResults.runId, runId)),
    db.select().from(customAgentExploitResults).where(eq(customAgentExploitResults.runId, runId)),
    db.select().from(customAgentFpRates).where(eq(customAgentFpRates.runId, runId)),
  ]);

  const fpCategories = Array.from(new Set(fps.map((f) => f.category)));
  const fpByAgent = new Map<string, Map<string, number>>();
  for (const r of fps) {
    if (!fpByAgent.has(r.agentId)) fpByAgent.set(r.agentId, new Map());
    fpByAgent.get(r.agentId)!.set(r.category, r.rate);
  }

  const customFpCategories = Array.from(new Set(customFps.map((f) => f.category)));
  const customFpByAgent = new Map<string, Map<string, number>>();
  for (const r of customFps) {
    if (!customFpByAgent.has(r.agentId)) customFpByAgent.set(r.agentId, new Map());
    customFpByAgent.get(r.agentId)!.set(r.category, r.rate);
  }

  return (
    <div className="wrap adm-wrap" style={{ maxWidth: 1280 }}>
      <div className="adm-row between" style={{ marginBottom: 8 }}>
        <Link href="/admin" className="lede" style={{ fontSize: 12 }}>← Back to dashboard</Link>
        <RunActions runId={run.id} isPublic={run.isPublic} />
      </div>

      <div className="adm-row" style={{ gap: 12, marginTop: 8 }}>
        <h1 className="adm-h1" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <TextInlineCell
            initial={run.version}
            action={updateRunMetaText}
            actionInput={{ id: run.id, field: "version" }}
            width={200}
            placeholder="v0.4"
          />
        </h1>
        <span className={`adm-status ${run.isPublic ? "public" : "hidden"}`}>
          {run.isPublic ? "public" : "hidden"}
        </span>
      </div>
      <p className="lede" style={{ marginTop: 8 }}>
        <span className="mono">{run.runId}</span> · created {new Date(run.createdAt).toISOString().slice(0, 10)}
        {" "}· judge{" "}
        <TextInlineCell
          initial={run.judgeModel}
          action={updateRunMetaText}
          actionInput={{ id: run.id, field: "judgeModel" }}
          width={420}
        />
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
          marginTop: 24,
        }}
      >
        {([
          { label: "Trials per task", field: "trialsPerTask", value: run.trialsPerTask },
          { label: "Total tasks", field: "totalTasks", value: run.totalTasks },
          { label: "Positive tasks", field: "positiveTasks", value: run.positiveTasks },
          { label: "Negative tasks", field: "negativeTasks", value: run.negativeTasks },
          { label: "Categories", field: "categoriesCount", value: run.categoriesCount },
        ] as const).map((m) => (
          <div key={m.field} className="adm-field">
            <span className="adm-label">{m.label}</span>
            <div style={{ paddingTop: 4 }}>
              <RunMetaIntCell value={m.value} runId={run.id} field={m.field} />
            </div>
          </div>
        ))}
      </div>

      <section className="adm-section">
        <EditableLeaderboard
          runId={runId}
          agents={agentRows}
          detect={detect}
          exploit={exploit}
        />
      </section>

      <section className="adm-section">
        <EditableAgentRanking
          runId={runId}
          agents={customAgentRows}
          detect={customResults}
          exploit={customExploit}
        />
      </section>

      <section className="adm-section">
        <EditableFpTable
          runId={runId}
          llmAgents={agentRows}
          llmCategories={fpCategories}
          llmRatesByAgent={fpByAgent}
          customAgents={customAgentRows}
          customCategories={customFpCategories}
          customRatesByAgent={customFpByAgent}
        />
      </section>

      <section className="adm-section">
        <EditableReasoningTable
          runId={runId}
          agents={agentRows}
          points={reasoning}
        />
      </section>
    </div>
  );
}
