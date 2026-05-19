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
import { eq } from "drizzle-orm";
import { z } from "zod";

async function assertAdmin() {
  const session = await auth();
  const login = (session?.user as { login?: string } | undefined)?.login;
  if (!session || !isAdmin(login)) {
    throw new Error("Unauthorized");
  }
}

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
  revalidatePath("/admin");
  revalidatePath("/admin/agents");
  revalidatePath("/");
}

export async function deleteAgent(formData: FormData) {
  await assertAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db.delete(agents).where(eq(agents.id, id));
  revalidatePath("/admin");
  revalidatePath("/admin/agents");
  revalidatePath("/");
}

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
  const m = parsed.meta;

  await db.transaction(async (tx) => {
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
  });

  revalidatePath("/");
  revalidatePath("/admin");
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
