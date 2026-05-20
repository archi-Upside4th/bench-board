"use server";

import { db } from "@/db";
import {
  agents,
  evalRuns,
  detectResults,
  exploitResults,
  fpRates,
  siteSettings,
  rawTrials,
} from "@/db/schema";
import { auth, isAdmin } from "@/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

async function assertAdmin() {
  const session = await auth();
  const login = (session?.user as { login?: string } | undefined)?.login;
  if (!session || !isAdmin(login)) {
    throw new Error("Unauthorized");
  }
}

function bustCaches() {
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/agents");
  revalidatePath("/admin/runs/new");
}

/* ============================ Agents ============================ */

const agentSchema = z.object({
  id: z.string().min(1).max(80),
  vendor: z.string().min(1).max(80),
  release_date: z.string().min(1).max(20),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Color must be a 6-digit hex value"),
});

export async function upsertAgent(formData: FormData) {
  await assertAdmin();
  const parsed = agentSchema.parse({
    id: formData.get("id"),
    vendor: formData.get("vendor"),
    release_date: formData.get("release_date"),
    color: formData.get("color"),
  });
  await db
    .insert(agents)
    .values({
      id: parsed.id,
      vendor: parsed.vendor,
      releaseDate: parsed.release_date,
      color: parsed.color,
    })
    .onConflictDoUpdate({
      target: agents.id,
      set: {
        vendor: parsed.vendor,
        releaseDate: parsed.release_date,
        color: parsed.color,
      },
    });
  bustCaches();
}

export async function deleteAgent(formData: FormData) {
  await assertAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db.delete(agents).where(eq(agents.id, id));
  bustCaches();
}

/* ============================ Run import (JSON, kept for power-users) ============================ */

const runImportSchema = z.object({
  meta: z.object({
    dataset_version: z.string(),
    total_tasks: z.number().int().positive(),
    negative_tasks: z.number().int().nonnegative(),
    positive_tasks: z.number().int().nonnegative(),
    categories: z.number().int().positive(),
    evaluation_run_id: z.string(),
    trials_per_task: z.number().int().positive(),
    judge_model: z.string(),
  }),
  agents: z
    .array(
      z.object({
        id: z.string(),
        vendor: z.string(),
        release_date: z.string(),
        color: z.string(),
      })
    )
    .optional(),
  summary_detect_blocked: z.array(
    z.object({
      agent: z.string(),
      precision: z.number(),
      recall: z.number(),
      f1: z.number(),
      f1_ci_low: z.number(),
      f1_ci_high: z.number(),
      cost_usd_per_task: z.number(),
      n_tasks: z.number().int(),
    })
  ),
  summary_exploit_blocked: z
    .array(
      z.object({
        agent: z.string(),
        success: z.number(),
        partial: z.number(),
        fail: z.number(),
        cost_usd_per_task: z.number(),
        n_tasks: z.number().int(),
      })
    )
    .default([]),
  fp_rate_by_negative_category: z
    .object({
      categories: z.array(z.string()),
      data: z.record(z.string(), z.array(z.number())),
    })
    .optional(),
  is_public: z.boolean().optional().default(true),
});

export type RunImport = z.infer<typeof runImportSchema>;

export async function importRunFromJson(payload: unknown) {
  await assertAdmin();
  const parsed = runImportSchema.parse(payload);
  await persistRun(parsed);
  bustCaches();
}

export async function importRunFromForm(formData: FormData) {
  const raw = String(formData.get("payload") ?? "").trim();
  if (!raw) throw new Error("Empty payload");
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    throw new Error("Invalid JSON: " + (e as Error).message);
  }
  await importRunFromJson(json);
  redirect("/admin");
}

async function persistRun(parsed: RunImport) {
  const m = parsed.meta;

  return db.transaction(async (tx) => {
    if (parsed.agents) {
      for (const a of parsed.agents) {
        await tx
          .insert(agents)
          .values({
            id: a.id,
            vendor: a.vendor,
            releaseDate: a.release_date,
            color: a.color,
          })
          .onConflictDoUpdate({
            target: agents.id,
            set: { vendor: a.vendor, releaseDate: a.release_date, color: a.color },
          });
      }
    }

    const [run] = await tx
      .insert(evalRuns)
      .values({
        version: m.dataset_version,
        runId: m.evaluation_run_id,
        judgeModel: m.judge_model,
        trialsPerTask: m.trials_per_task,
        totalTasks: m.total_tasks,
        positiveTasks: m.positive_tasks,
        negativeTasks: m.negative_tasks,
        categoriesCount: m.categories,
        isPublic: parsed.is_public,
      })
      .onConflictDoUpdate({
        target: evalRuns.runId,
        set: {
          version: m.dataset_version,
          judgeModel: m.judge_model,
          trialsPerTask: m.trials_per_task,
          totalTasks: m.total_tasks,
          positiveTasks: m.positive_tasks,
          negativeTasks: m.negative_tasks,
          categoriesCount: m.categories,
          isPublic: parsed.is_public,
        },
      })
      .returning();

    await tx.delete(detectResults).where(eq(detectResults.runId, run.id));
    await tx.delete(exploitResults).where(eq(exploitResults.runId, run.id));
    await tx.delete(fpRates).where(eq(fpRates.runId, run.id));

    if (parsed.summary_detect_blocked.length) {
      await tx.insert(detectResults).values(
        parsed.summary_detect_blocked.map((r) => ({
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
    }
    if (parsed.summary_exploit_blocked.length) {
      await tx.insert(exploitResults).values(
        parsed.summary_exploit_blocked.map((r) => ({
          runId: run.id,
          agentId: r.agent,
          success: r.success,
          partial: r.partial,
          fail: r.fail,
          costUsdPerTask: r.cost_usd_per_task,
          nTasks: r.n_tasks,
        }))
      );
    }

    const fp = parsed.fp_rate_by_negative_category;
    if (fp && fp.categories.length) {
      const rows: { runId: number; agentId: string; category: string; rate: number }[] = [];
      for (const [agentId, vals] of Object.entries(fp.data)) {
        fp.categories.forEach((cat, i) => {
          if (vals[i] !== undefined) {
            rows.push({ runId: run.id, agentId, category: cat, rate: vals[i] });
          }
        });
      }
      if (rows.length) await tx.insert(fpRates).values(rows);
    }

    return run;
  });
}

/* ============================ Run create (grid form) ============================ */

const createRunSchema = z.object({
  meta: z.object({
    dataset_version: z.string().min(1),
    evaluation_run_id: z.string().min(1),
    judge_model: z.string().min(1),
    trials_per_task: z.number().int().positive(),
    total_tasks: z.number().int().positive(),
    positive_tasks: z.number().int().nonnegative(),
    negative_tasks: z.number().int().nonnegative(),
    categories: z.number().int().positive(),
    is_public: z.boolean(),
  }),
  detect: z.array(
    z.object({
      agent: z.string(),
      precision: z.number().min(0).max(1),
      recall: z.number().min(0).max(1),
      f1: z.number().min(0).max(1),
      f1_ci_low: z.number().min(0).max(1),
      f1_ci_high: z.number().min(0).max(1),
      cost_usd_per_task: z.number().min(0),
      n_tasks: z.number().int().nonnegative(),
    })
  ),
  exploit: z.array(
    z.object({
      agent: z.string(),
      success: z.number().min(0).max(1),
      partial: z.number().min(0).max(1),
      fail: z.number().min(0).max(1),
      cost_usd_per_task: z.number().min(0),
      n_tasks: z.number().int().nonnegative(),
    })
  ),
  fp: z.object({
    categories: z.array(z.string()),
    rows: z.array(
      z.object({
        agent: z.string(),
        rates: z.array(z.number().min(0).max(1)),
      })
    ),
  }),
});

export type CreateRunInput = z.infer<typeof createRunSchema>;

export async function createRun(input: CreateRunInput): Promise<{ id: number }> {
  await assertAdmin();
  const parsed = createRunSchema.parse(input);

  const fpData: Record<string, number[]> = {};
  for (const row of parsed.fp.rows) {
    fpData[row.agent] = row.rates;
  }

  const run = await persistRun({
    meta: parsed.meta,
    summary_detect_blocked: parsed.detect,
    summary_exploit_blocked: parsed.exploit,
    fp_rate_by_negative_category: {
      categories: parsed.fp.categories,
      data: fpData,
    },
    is_public: parsed.meta.is_public,
  });

  bustCaches();
  return { id: run.id };
}

/* ============================ Run mutations (detail page) ============================ */

const detectCellSchema = z.object({
  runId: z.number().int(),
  agentId: z.string(),
  field: z.enum([
    "precision",
    "recall",
    "f1",
    "f1CiLow",
    "f1CiHigh",
    "costUsdPerTask",
    "nTasks",
  ]),
  value: z.number(),
});

export async function updateDetectCell(input: z.input<typeof detectCellSchema>) {
  await assertAdmin();
  const { runId, agentId, field, value } = detectCellSchema.parse(input);
  await db
    .update(detectResults)
    .set({ [field]: value })
    .where(and(eq(detectResults.runId, runId), eq(detectResults.agentId, agentId)));
  bustCaches();
}

/**
 * Updates F1 CI low/high so the confidence interval is symmetric around the
 * row's current F1 with the given half-width. Lets admins edit "±0.05" as a
 * single value instead of two separate bounds.
 */
const detectCiSchema = z.object({
  runId: z.number().int(),
  agentId: z.string(),
  value: z.number().min(0).max(1),
});
export async function updateDetectCiHalf(input: z.input<typeof detectCiSchema>) {
  await assertAdmin();
  const { runId, agentId, value } = detectCiSchema.parse(input);
  const [row] = await db
    .select({ f1: detectResults.f1 })
    .from(detectResults)
    .where(and(eq(detectResults.runId, runId), eq(detectResults.agentId, agentId)))
    .limit(1);
  if (!row) return;
  const low = Math.max(0, row.f1 - value);
  const high = Math.min(1, row.f1 + value);
  await db
    .update(detectResults)
    .set({ f1CiLow: low, f1CiHigh: high })
    .where(and(eq(detectResults.runId, runId), eq(detectResults.agentId, agentId)));
  bustCaches();
}

const exploitCellSchema = z.object({
  runId: z.number().int(),
  agentId: z.string(),
  field: z.enum(["success", "partial", "fail", "costUsdPerTask", "nTasks"]),
  value: z.number(),
});

export async function updateExploitCell(input: z.input<typeof exploitCellSchema>) {
  await assertAdmin();
  const { runId, agentId, field, value } = exploitCellSchema.parse(input);
  await db
    .update(exploitResults)
    .set({ [field]: value })
    .where(and(eq(exploitResults.runId, runId), eq(exploitResults.agentId, agentId)));
  bustCaches();
}

const fpCellSchema = z.object({
  runId: z.number().int(),
  agentId: z.string(),
  category: z.string(),
  value: z.number().min(0).max(1),
});

export async function updateFpCell(input: z.input<typeof fpCellSchema>) {
  await assertAdmin();
  const { runId, agentId, category, value } = fpCellSchema.parse(input);
  await db
    .update(fpRates)
    .set({ rate: value })
    .where(
      and(
        eq(fpRates.runId, runId),
        eq(fpRates.agentId, agentId),
        eq(fpRates.category, category)
      )
    );
  bustCaches();
}

const runMetaSchema = z.object({
  id: z.number().int(),
  version: z.string().min(1),
  judgeModel: z.string().min(1),
  trialsPerTask: z.number().int().positive(),
  totalTasks: z.number().int().positive(),
  positiveTasks: z.number().int().nonnegative(),
  negativeTasks: z.number().int().nonnegative(),
  categoriesCount: z.number().int().positive(),
});

export async function updateRunMeta(input: z.input<typeof runMetaSchema>) {
  await assertAdmin();
  const v = runMetaSchema.parse(input);
  await db
    .update(evalRuns)
    .set({
      version: v.version,
      judgeModel: v.judgeModel,
      trialsPerTask: v.trialsPerTask,
      totalTasks: v.totalTasks,
      positiveTasks: v.positiveTasks,
      negativeTasks: v.negativeTasks,
      categoriesCount: v.categoriesCount,
    })
    .where(eq(evalRuns.id, v.id));
  bustCaches();
}

const runMetaTextSchema = z.object({
  id: z.number().int(),
  field: z.enum(["version", "judgeModel"]),
  value: z.string().min(1).max(400),
});
export async function updateRunMetaText(input: z.input<typeof runMetaTextSchema>) {
  await assertAdmin();
  const { id, field, value } = runMetaTextSchema.parse(input);
  await db.update(evalRuns).set({ [field]: value }).where(eq(evalRuns.id, id));
  bustCaches();
}

const runMetaNumberSchema = z.object({
  id: z.number().int(),
  field: z.enum(["trialsPerTask", "totalTasks", "positiveTasks", "negativeTasks", "categoriesCount"]),
  value: z.number().int().nonnegative(),
});
export async function updateRunMetaNumber(input: z.input<typeof runMetaNumberSchema>) {
  await assertAdmin();
  const { id, field, value } = runMetaNumberSchema.parse(input);
  await db.update(evalRuns).set({ [field]: value }).where(eq(evalRuns.id, id));
  bustCaches();
}

export async function setRunPublic(runId: number, isPublic: boolean) {
  await assertAdmin();
  await db.update(evalRuns).set({ isPublic }).where(eq(evalRuns.id, runId));
  bustCaches();
}

export async function deleteRun(runId: number) {
  await assertAdmin();
  await db.delete(evalRuns).where(eq(evalRuns.id, runId));
  bustCaches();
}

/* ============================ Site settings ============================ */

const siteSettingsSchema = z.object({
  brandLeft: z.string().max(40),
  brandRight: z.string().max(40),
  siteSubtitle: z.string().max(200),
  githubUrl: z.string().url().or(z.literal("")),
  heroEyebrow: z.string().max(80),
  heroTitle: z.string().max(80),
  heroDescription: z.string().max(800),
  heroStat1Label: z.string().max(80),
  heroStat2Label: z.string().max(80),
  heroStat3Label: z.string().max(80),
  heroStat4Label: z.string().max(80),
  leaderboardTitle: z.string().max(120),
  leaderboardLede: z.string().max(800),
  paretoTitle: z.string().max(120),
  paretoLede: z.string().max(800),
  paretoQuote: z.string().max(400),
  paretoBody: z.string().max(800),
  fpTitle: z.string().max(120),
  fpLede: z.string().max(800),
  methodologyTitle: z.string().max(120),
  methodologyDetectGrader: z.string().max(400),
  methodologyExploitGrader: z.string().max(400),
  citeBibtex: z.string().max(2000),
  aboutTitle: z.string().max(120),
  aboutLede: z.string().max(1000),
  footerCopyright: z.string().max(200),
});

export type SiteSettingsInput = z.infer<typeof siteSettingsSchema>;

export async function updateSiteSettings(input: SiteSettingsInput) {
  await assertAdmin();
  const parsed = siteSettingsSchema.parse(input);
  await db
    .insert(siteSettings)
    .values({ id: 1, ...parsed, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: siteSettings.id,
      set: { ...parsed, updatedAt: new Date() },
    });
  bustCaches();
}

/* ============================ Row CRUD (add/delete) ============================ */

const rowKeySchema = z.object({
  runId: z.number().int(),
  agentId: z.string().min(1),
});

export async function addDetectRow(input: z.input<typeof rowKeySchema>) {
  await assertAdmin();
  const { runId, agentId } = rowKeySchema.parse(input);
  await db
    .insert(detectResults)
    .values({
      runId,
      agentId,
      precision: 0,
      recall: 0,
      f1: 0,
      f1CiLow: 0,
      f1CiHigh: 0,
      costUsdPerTask: 0,
      nTasks: 0,
    })
    .onConflictDoNothing();
  bustCaches();
}

export async function deleteDetectRow(input: z.input<typeof rowKeySchema>) {
  await assertAdmin();
  const { runId, agentId } = rowKeySchema.parse(input);
  await db
    .delete(detectResults)
    .where(and(eq(detectResults.runId, runId), eq(detectResults.agentId, agentId)));
  bustCaches();
}

export async function addExploitRow(input: z.input<typeof rowKeySchema>) {
  await assertAdmin();
  const { runId, agentId } = rowKeySchema.parse(input);
  await db
    .insert(exploitResults)
    .values({
      runId,
      agentId,
      success: 0,
      partial: 0,
      fail: 0,
      costUsdPerTask: 0,
      nTasks: 0,
    })
    .onConflictDoNothing();
  bustCaches();
}

export async function deleteExploitRow(input: z.input<typeof rowKeySchema>) {
  await assertAdmin();
  const { runId, agentId } = rowKeySchema.parse(input);
  await db
    .delete(exploitResults)
    .where(and(eq(exploitResults.runId, runId), eq(exploitResults.agentId, agentId)));
  bustCaches();
}

/* ============================ Per-trial import (auto-aggregate) ============================ */

const trialSchema = z.object({
  run_id: z.string().optional(),
  task: z.string().optional(),
  agent: z.string().optional(),
  model: z.string().optional(),
  mode: z.enum(["detect", "exploit"]).optional(),
  label: z.string().nullable().optional(),
  score: z.number().nullable().optional(),
  cost_usd: z.number().nullable().optional(),
  tp_findings: z.number().nullable().optional(),
  fp_findings_estimate: z.number().nullable().optional(),
  fn_findings: z.number().nullable().optional(),
  reasoning_tokens: z.number().nullable().optional(),
  ts: z.string().optional(),
}).passthrough();

const DEFAULT_PALETTE = [
  "#D97757", "#10A37F", "#4285F4", "#7C3AED",
  "#FF6A00", "#E89B7C", "#5DC09F", "#22D3EE", "#F472B6",
];
function colorForKey(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return DEFAULT_PALETTE[h % DEFAULT_PALETTE.length];
}
function vendorFromModel(model: string): string {
  if (model.startsWith("openai/")) return "OpenAI";
  if (model.startsWith("anthropic/") || model.includes("claude")) return "Anthropic";
  if (model.startsWith("google/") || model.includes("gemini")) return "Google";
  if (model.startsWith("deepseek/") || model.includes("deepseek")) return "DeepSeek";
  if (model.startsWith("alibaba/") || model.includes("qwen")) return "Alibaba";
  if (model.startsWith("meta/") || model.includes("llama")) return "Meta";
  const slash = model.indexOf("/");
  if (slash > 0) return model.slice(0, slash).replace(/^./, (c) => c.toUpperCase());
  return "Unknown";
}

export type TrialImportSummary = {
  runs: { runId: string; version: string; detectAgents: number; exploitAgents: number }[];
  agentsCreated: string[];
  trialsParsed: number;
  trialsSkipped: number;
  warnings: string[];
};

/**
 * Accumulating import:
 *   1. Parse trials from JSON / NDJSON / single object
 *   2. INSERT each trial into raw_trials (append — never overwrites)
 *   3. For every (agent, mode) touched, re-aggregate from the FULL accumulated set
 *      and upsert into the target run's detect_results / exploit_results
 *
 * The per-record `run_id` is ignored for grouping — every paste accumulates into
 * the single target run (defaults to the most recent existing run).
 */
export async function importTrialResults(
  rawText: string,
  opts: {
    agentKeyField?: "model" | "agent";
    /** Run that receives the recomputed aggregates. Defaults to most-recent run. */
    targetRunId?: number;
  } = {}
): Promise<TrialImportSummary> {
  await assertAdmin();
  const text = rawText.trim();
  if (!text) throw new Error("Empty input.");

  // Pick target run (default: most-recent existing). The JSON's run_id is kept
  // only as metadata in raw_trials.source_run_id, never used for grouping.
  let targetRun: { id: number; runId: string; version: string };
  if (typeof opts.targetRunId === "number") {
    const [r] = await db
      .select({ id: evalRuns.id, runId: evalRuns.runId, version: evalRuns.version })
      .from(evalRuns)
      .where(eq(evalRuns.id, opts.targetRunId))
      .limit(1);
    if (!r) throw new Error(`Target run #${opts.targetRunId} not found.`);
    targetRun = r;
  } else {
    const [latest] = await db
      .select({ id: evalRuns.id, runId: evalRuns.runId, version: evalRuns.version })
      .from(evalRuns)
      .orderBy(desc(evalRuns.createdAt))
      .limit(1);
    if (!latest) {
      // No runs at all — auto-create a sensible default so admins don't have
      // to visit /admin/runs/new just to start accumulating.
      const [created] = await db
        .insert(evalRuns)
        .values({
          version: "v0.1",
          runId: `default-${Date.now().toString(36)}`,
          judgeModel: "auto",
          trialsPerTask: 1,
          totalTasks: 1,
          positiveTasks: 1,
          negativeTasks: 0,
          categoriesCount: 1,
          isPublic: true,
        })
        .returning({ id: evalRuns.id, runId: evalRuns.runId, version: evalRuns.version });
      targetRun = created;
    } else {
      targetRun = latest;
    }
  }

  // Parse
  let records: unknown[] = [];
  try {
    const parsed = JSON.parse(text);
    records = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    records = lines.map((line, i) => {
      try {
        return JSON.parse(line);
      } catch (e) {
        throw new Error(`Line ${i + 1} is not valid JSON: ${(e as Error).message}`);
      }
    });
  }
  if (records.length === 0) throw new Error("No records found in input.");

  const summary: TrialImportSummary = {
    runs: [],
    agentsCreated: [],
    trialsParsed: 0,
    trialsSkipped: 0,
    warnings: [],
  };

  const agentKeyField = opts.agentKeyField ?? "model";
  type Pending = {
    agentKey: string;
    mode: "detect" | "exploit";
    raw: z.infer<typeof trialSchema>;
  };
  const pendings: Pending[] = [];
  const touched = new Set<string>(); // "agentKey|mode"
  const uniqueAgents = new Set<string>();

  for (const raw of records) {
    const r = trialSchema.safeParse(raw);
    if (!r.success) {
      summary.trialsSkipped++;
      summary.warnings.push(`Skipped malformed record: ${r.error.errors[0]?.message ?? "unknown"}`);
      continue;
    }
    const t = r.data;
    if (!t.mode) { summary.trialsSkipped++; summary.warnings.push(`Skipped record without mode`); continue; }
    const rawKey = (agentKeyField === "model" ? t.model : t.agent) ?? t.agent ?? t.model;
    if (!rawKey) { summary.trialsSkipped++; summary.warnings.push(`Skipped record without agent identifier`); continue; }
    const agentKey = rawKey.toLowerCase();

    summary.trialsParsed++;
    pendings.push({ agentKey, mode: t.mode, raw: t });
    touched.add(`${agentKey}|${t.mode}`);
    uniqueAgents.add(agentKey);
  }

  await db.transaction(async (tx) => {
    // 1) Ensure agents exist
    for (const agentKey of uniqueAgents) {
      const [existing] = await tx.select().from(agents).where(eq(agents.id, agentKey)).limit(1);
      if (!existing) {
        await tx.insert(agents).values({
          id: agentKey,
          vendor: vendorFromModel(agentKey),
          releaseDate: new Date().toISOString().slice(0, 7),
          color: colorForKey(agentKey),
        }).onConflictDoNothing();
        summary.agentsCreated.push(agentKey);
      }
    }

    // 2) APPEND every trial to raw_trials (never overwrites — that's how accumulation works)
    if (pendings.length) {
      await tx.insert(rawTrials).values(
        pendings.map((p) => ({
          agentId: p.agentKey,
          mode: p.mode,
          task: p.raw.task ?? null,
          tpFindings: p.raw.tp_findings ?? null,
          fpFindings: p.raw.fp_findings_estimate ?? null,
          fnFindings: p.raw.fn_findings ?? null,
          label: p.raw.label ?? null,
          costUsd: p.raw.cost_usd ?? null,
          reasoningTokens: p.raw.reasoning_tokens ?? null,
          ts: p.raw.ts ?? null,
          sourceRunId: p.raw.run_id ?? null,
        }))
      );
    }

    // 3) For each touched (agent, mode), recompute aggregate from ALL accumulated trials
    let detectAgents = 0;
    let exploitAgents = 0;

    for (const key of touched) {
      const [agentKey, modeStr] = key.split("|");
      const mode = modeStr as "detect" | "exploit";

      const allTrials = await tx
        .select()
        .from(rawTrials)
        .where(and(eq(rawTrials.agentId, agentKey), eq(rawTrials.mode, mode)));

      if (allTrials.length === 0) continue;

      const tasks = new Set(allTrials.map((t) => t.task).filter(Boolean) as string[]);
      const nTasks = tasks.size || allTrials.length;
      const validCosts = allTrials.map((t) => t.costUsd).filter((c): c is number => typeof c === "number");
      const avgCost = validCosts.length ? validCosts.reduce((s, c) => s + c, 0) / validCosts.length : 0;
      const validReasoning = allTrials
        .map((t) => t.reasoningTokens)
        .filter((r): r is number => typeof r === "number");
      const avgReasoning = validReasoning.length
        ? validReasoning.reduce((s, v) => s + v, 0) / validReasoning.length
        : null;

      if (mode === "detect") {
        const tp = allTrials.reduce((s, t) => s + (t.tpFindings ?? 0), 0);
        const fp = allTrials.reduce((s, t) => s + (t.fpFindings ?? 0), 0);
        const fn = allTrials.reduce((s, t) => s + (t.fnFindings ?? 0), 0);
        const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
        const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
        const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

        await tx
          .insert(detectResults)
          .values({
            runId: targetRun.id,
            agentId: agentKey,
            precision, recall, f1,
            f1CiLow: f1, f1CiHigh: f1,
            costUsdPerTask: avgCost,
            reasoningTokensPerTask: avgReasoning,
            nTasks,
          })
          .onConflictDoUpdate({
            target: [detectResults.runId, detectResults.agentId],
            set: {
              precision, recall, f1, f1CiLow: f1, f1CiHigh: f1,
              costUsdPerTask: avgCost,
              reasoningTokensPerTask: avgReasoning,
              nTasks,
            },
          });
        detectAgents++;
      } else {
        const total = allTrials.length;
        const success = allTrials.filter((t) => (t.label ?? "").toLowerCase().includes("success")).length / total;
        const partial = allTrials.filter((t) => (t.label ?? "").toLowerCase().includes("partial")).length / total;
        const fail = allTrials.filter((t) => (t.label ?? "").toLowerCase().includes("fail")).length / total;

        await tx
          .insert(exploitResults)
          .values({
            runId: targetRun.id,
            agentId: agentKey,
            success, partial, fail,
            costUsdPerTask: avgCost,
            nTasks,
          })
          .onConflictDoUpdate({
            target: [exploitResults.runId, exploitResults.agentId],
            set: { success, partial, fail, costUsdPerTask: avgCost, nTasks },
          });
        exploitAgents++;
      }
    }

    summary.runs.push({
      runId: targetRun.runId,
      version: targetRun.version,
      detectAgents,
      exploitAgents,
    });
  });

  bustCaches();
  return summary;
}

/**
 * Wipes every accumulated raw trial. Also clears the resulting detect_results /
 * exploit_results rows from the given run (so the leaderboard reflects the empty
 * accumulator). Use to reset and start over.
 */
export async function clearAccumulatedTrials(opts: { targetRunId?: number } = {}) {
  await assertAdmin();
  await db.transaction(async (tx) => {
    await tx.delete(rawTrials);
    if (typeof opts.targetRunId === "number") {
      await tx.delete(detectResults).where(eq(detectResults.runId, opts.targetRunId));
      await tx.delete(exploitResults).where(eq(exploitResults.runId, opts.targetRunId));
    }
  });
  bustCaches();
}

/* ============================ FP — add/delete row + category ============================ */

const fpCategorySchema = z.object({
  runId: z.number().int(),
  category: z.string().min(1).max(120),
});

export async function addFpCategory(input: z.input<typeof fpCategorySchema>) {
  await assertAdmin();
  const { runId, category } = fpCategorySchema.parse(input);
  // Insert a 0-value row for every agent that already has any fp rate in this run,
  // OR if none yet, for every agent in DB (so the column appears for everyone).
  const existingAgents = await db
    .selectDistinct({ id: fpRates.agentId })
    .from(fpRates)
    .where(eq(fpRates.runId, runId));
  const agentIds = existingAgents.length
    ? existingAgents.map((r) => r.id)
    : (await db.select({ id: agents.id }).from(agents)).map((r) => r.id);
  if (agentIds.length === 0) return;
  await db
    .insert(fpRates)
    .values(agentIds.map((agentId) => ({ runId, agentId, category, rate: 0 })))
    .onConflictDoNothing();
  bustCaches();
}

export async function deleteFpCategory(input: z.input<typeof fpCategorySchema>) {
  await assertAdmin();
  const { runId, category } = fpCategorySchema.parse(input);
  await db
    .delete(fpRates)
    .where(and(eq(fpRates.runId, runId), eq(fpRates.category, category)));
  bustCaches();
}

export async function addFpAgentRow(input: z.input<typeof rowKeySchema>) {
  await assertAdmin();
  const { runId, agentId } = rowKeySchema.parse(input);
  // Find all categories currently used in this run; add a 0-value row per category.
  const cats = await db
    .selectDistinct({ category: fpRates.category })
    .from(fpRates)
    .where(eq(fpRates.runId, runId));
  if (cats.length === 0) return;
  await db
    .insert(fpRates)
    .values(cats.map((c) => ({ runId, agentId, category: c.category, rate: 0 })))
    .onConflictDoNothing();
  bustCaches();
}

export async function deleteFpAgentRow(input: z.input<typeof rowKeySchema>) {
  await assertAdmin();
  const { runId, agentId } = rowKeySchema.parse(input);
  await db
    .delete(fpRates)
    .where(and(eq(fpRates.runId, runId), eq(fpRates.agentId, agentId)));
  bustCaches();
}
