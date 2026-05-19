// Seeds the database with the original prototype's mock data.
// Run with: pnpm db:seed   (requires DATABASE_URL in .env.local)
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { db } from "../src/db";
import { agents, evalRuns, detectResults, exploitResults, fpRates } from "../src/db/schema";
import { eq } from "drizzle-orm";

const DATA = {
  agents: [
    { id: "claude-opus-4-7",   vendor: "Anthropic", release_date: "2026-03", color: "#D97757" },
    { id: "claude-sonnet-4-6", vendor: "Anthropic", release_date: "2026-01", color: "#E89B7C" },
    { id: "gpt-5",             vendor: "OpenAI",    release_date: "2025-12", color: "#10A37F" },
    { id: "gpt-5-mini",        vendor: "OpenAI",    release_date: "2025-12", color: "#5DC09F" },
    { id: "gemini-2.5-pro",    vendor: "Google",    release_date: "2025-09", color: "#4285F4" },
    { id: "deepseek-v3.5",     vendor: "DeepSeek",  release_date: "2025-11", color: "#7C3AED" },
    { id: "qwen3-coder-480b",  vendor: "Alibaba",   release_date: "2025-10", color: "#FF6A00" },
  ],
  meta: {
    dataset_version: "v1.0",
    total_tasks: 120,
    negative_tasks: 25,
    positive_tasks: 95,
    categories: 7,
    evaluation_run_id: "bench-board-eval-2026-05-week2",
    trials_per_task: 3,
    judge_model: "gpt-5 · claude-sonnet-4.6 · gemini-3.1-pro · majority-of-3",
  },
  detect: [
    { agent: "claude-opus-4-7",   precision: 0.72, recall: 0.81, f1: 0.76, f1_ci_low: 0.71, f1_ci_high: 0.81, cost_usd_per_task: 1.84, n_tasks: 120 },
    { agent: "gpt-5",             precision: 0.69, recall: 0.83, f1: 0.75, f1_ci_low: 0.70, f1_ci_high: 0.80, cost_usd_per_task: 2.21, n_tasks: 120 },
    { agent: "claude-sonnet-4-6", precision: 0.65, recall: 0.74, f1: 0.69, f1_ci_low: 0.64, f1_ci_high: 0.74, cost_usd_per_task: 0.42, n_tasks: 120 },
    { agent: "gemini-2.5-pro",    precision: 0.61, recall: 0.78, f1: 0.68, f1_ci_low: 0.63, f1_ci_high: 0.73, cost_usd_per_task: 0.88, n_tasks: 120 },
    { agent: "deepseek-v3.5",     precision: 0.58, recall: 0.71, f1: 0.64, f1_ci_low: 0.59, f1_ci_high: 0.69, cost_usd_per_task: 0.19, n_tasks: 120 },
    { agent: "gpt-5-mini",        precision: 0.55, recall: 0.68, f1: 0.61, f1_ci_low: 0.56, f1_ci_high: 0.66, cost_usd_per_task: 0.31, n_tasks: 120 },
    { agent: "qwen3-coder-480b",  precision: 0.49, recall: 0.62, f1: 0.55, f1_ci_low: 0.50, f1_ci_high: 0.60, cost_usd_per_task: 0.24, n_tasks: 120 },
  ],
  exploit: [
    { agent: "claude-opus-4-7",   success: 0.41, partial: 0.12, fail: 0.47, cost_usd_per_task: 4.20, n_tasks: 50 },
    { agent: "gpt-5",             success: 0.38, partial: 0.14, fail: 0.48, cost_usd_per_task: 5.10, n_tasks: 50 },
    { agent: "claude-sonnet-4-6", success: 0.28, partial: 0.18, fail: 0.54, cost_usd_per_task: 1.18, n_tasks: 50 },
    { agent: "gemini-2.5-pro",    success: 0.24, partial: 0.10, fail: 0.66, cost_usd_per_task: 2.04, n_tasks: 50 },
    { agent: "deepseek-v3.5",     success: 0.16, partial: 0.08, fail: 0.76, cost_usd_per_task: 0.52, n_tasks: 50 },
    { agent: "gpt-5-mini",        success: 0.12, partial: 0.10, fail: 0.78, cost_usd_per_task: 0.78, n_tasks: 50 },
    { agent: "qwen3-coder-480b",  success: 0.08, partial: 0.06, fail: 0.86, cost_usd_per_task: 0.61, n_tasks: 50 },
  ],
  fp: {
    categories: [
      "Trusted Callee Reentrancy", "Permissionless by Design", "0.8+ Overflow",
      "Trusted ERC20", "Timestamp Long Window", "Bounded Unchecked",
      "Canonical Address", "Chainlink Aggregator", "Internal-Only Slippage",
      "Bounded Loop", "EIP-712 Replay Protection",
    ],
    data: {
      "claude-opus-4-7":   [0.12, 0.08, 0.04, 0.06, 0.18, 0.10, 0.14, 0.09, 0.22, 0.07, 0.11],
      "gpt-5":             [0.15, 0.11, 0.06, 0.08, 0.21, 0.13, 0.16, 0.12, 0.19, 0.09, 0.14],
      "claude-sonnet-4-6": [0.18, 0.14, 0.09, 0.11, 0.25, 0.16, 0.21, 0.15, 0.27, 0.12, 0.18],
      "gemini-2.5-pro":    [0.22, 0.16, 0.08, 0.12, 0.28, 0.18, 0.24, 0.17, 0.31, 0.14, 0.20],
      "deepseek-v3.5":     [0.28, 0.21, 0.14, 0.18, 0.34, 0.24, 0.30, 0.22, 0.36, 0.19, 0.26],
      "gpt-5-mini":        [0.31, 0.24, 0.16, 0.21, 0.38, 0.28, 0.33, 0.26, 0.41, 0.22, 0.29],
      "qwen3-coder-480b":  [0.38, 0.29, 0.22, 0.26, 0.44, 0.34, 0.39, 0.31, 0.48, 0.28, 0.35],
    },
  },
} as const;

async function main() {
  console.log("Seeding agents…");
  for (const a of DATA.agents) {
    await db
      .insert(agents)
      .values({ id: a.id, vendor: a.vendor, releaseDate: a.release_date, color: a.color })
      .onConflictDoUpdate({
        target: agents.id,
        set: { vendor: a.vendor, releaseDate: a.release_date, color: a.color },
      });
  }

  console.log("Seeding run…");
  const [run] = await db
    .insert(evalRuns)
    .values({
      version: DATA.meta.dataset_version,
      runId: DATA.meta.evaluation_run_id,
      judgeModel: DATA.meta.judge_model,
      trialsPerTask: DATA.meta.trials_per_task,
      totalTasks: DATA.meta.total_tasks,
      positiveTasks: DATA.meta.positive_tasks,
      negativeTasks: DATA.meta.negative_tasks,
      categoriesCount: DATA.meta.categories,
      isPublic: true,
    })
    .onConflictDoUpdate({
      target: evalRuns.runId,
      set: {
        version: DATA.meta.dataset_version,
        judgeModel: DATA.meta.judge_model,
        trialsPerTask: DATA.meta.trials_per_task,
        totalTasks: DATA.meta.total_tasks,
        positiveTasks: DATA.meta.positive_tasks,
        negativeTasks: DATA.meta.negative_tasks,
        categoriesCount: DATA.meta.categories,
      },
    })
    .returning();

  console.log(`Run id ${run.id}; replacing result rows…`);
  await db.delete(detectResults).where(eq(detectResults.runId, run.id));
  await db.delete(exploitResults).where(eq(exploitResults.runId, run.id));
  await db.delete(fpRates).where(eq(fpRates.runId, run.id));

  await db.insert(detectResults).values(
    DATA.detect.map((r) => ({
      runId: run.id,
      agentId: r.agent,
      precision: r.precision,
      recall: r.recall,
      f1: r.f1,
      f1CiLow: r.f1_ci_low,
      f1CiHigh: r.f1_ci_high,
      costUsdPerTask: r.cost_usd_per_task,
      nTasks: r.n_tasks,
    }))
  );
  await db.insert(exploitResults).values(
    DATA.exploit.map((r) => ({
      runId: run.id,
      agentId: r.agent,
      success: r.success,
      partial: r.partial,
      fail: r.fail,
      costUsdPerTask: r.cost_usd_per_task,
      nTasks: r.n_tasks,
    }))
  );

  const fpRows: { runId: number; agentId: string; category: string; rate: number }[] = [];
  for (const [agentId, vals] of Object.entries(DATA.fp.data)) {
    DATA.fp.categories.forEach((cat, i) => {
      fpRows.push({ runId: run.id, agentId, category: cat, rate: vals[i] });
    });
  }
  await db.insert(fpRates).values(fpRows);

  console.log("Done.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
