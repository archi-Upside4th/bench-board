"use server";

import { db } from "@/db";
import {
  agents,
  evalRuns,
  detectResults,
  exploitResults,
  fpRates,
} from "@/db/schema";
import { auth, isAdmin } from "@/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
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
  rate: z.number().min(0).max(1),
});

export async function updateFpCell(input: z.input<typeof fpCellSchema>) {
  await assertAdmin();
  const { runId, agentId, category, rate } = fpCellSchema.parse(input);
  await db
    .update(fpRates)
    .set({ rate })
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
