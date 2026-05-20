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
} from "@/db/schema";
import { desc, eq } from "drizzle-orm";

export type LeaderboardPayload = {
  run: typeof evalRuns.$inferSelect;
  agents: (typeof agents.$inferSelect)[];
  detect: (typeof detectResults.$inferSelect)[];
  exploit: (typeof exploitResults.$inferSelect)[];
  fpRows: { agentId: string; values: { category: string; rate: number }[] }[];
  fpCategories: string[];
  reasoning: (typeof reasoningPoints.$inferSelect)[];
  customAgents: (typeof customAgents.$inferSelect)[];
  customAgentResults: (typeof customAgentResults.$inferSelect)[];
};

export async function getLatestRun(): Promise<LeaderboardPayload | null> {
  const [run] = await db
    .select()
    .from(evalRuns)
    .where(eq(evalRuns.isPublic, true))
    .orderBy(desc(evalRuns.createdAt))
    .limit(1);

  if (!run) return null;

  const [agentRows, detect, exploit, fps, reasoning, customAgentRows, customAgentResultsRows] = await Promise.all([
    db.select().from(agents),
    db.select().from(detectResults).where(eq(detectResults.runId, run.id)),
    db.select().from(exploitResults).where(eq(exploitResults.runId, run.id)),
    db.select().from(fpRates).where(eq(fpRates.runId, run.id)),
    db.select().from(reasoningPoints).where(eq(reasoningPoints.runId, run.id)),
    db.select().from(customAgents),
    db.select().from(customAgentResults).where(eq(customAgentResults.runId, run.id)),
  ]);

  const categoriesSet = new Set<string>();
  for (const r of fps) categoriesSet.add(r.category);
  const fpCategories = Array.from(categoriesSet);

  const byAgent = new Map<string, { category: string; rate: number }[]>();
  for (const r of fps) {
    const arr = byAgent.get(r.agentId) ?? [];
    arr.push({ category: r.category, rate: r.rate });
    byAgent.set(r.agentId, arr);
  }

  const fpRows = Array.from(byAgent.entries()).map(([agentId, values]) => ({
    agentId,
    values,
  }));

  return {
    run,
    agents: agentRows,
    detect,
    exploit,
    fpRows,
    fpCategories,
    reasoning,
    customAgents: customAgentRows,
    customAgentResults: customAgentResultsRows,
  };
}
