import {
  pgTable,
  serial,
  text,
  integer,
  real,
  timestamp,
  date,
  boolean,
  primaryKey,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const agents = pgTable("agents", {
  id: text("id").primaryKey(),
  vendor: text("vendor").notNull(),
  releaseDate: text("release_date").notNull(),
  color: text("color").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const evalRuns = pgTable("eval_runs", {
  id: serial("id").primaryKey(),
  version: text("version").notNull(),
  runId: text("run_id").notNull().unique(),
  judgeModel: text("judge_model").notNull(),
  trialsPerTask: integer("trials_per_task").notNull(),
  totalTasks: integer("total_tasks").notNull(),
  positiveTasks: integer("positive_tasks").notNull(),
  negativeTasks: integer("negative_tasks").notNull(),
  categoriesCount: integer("categories_count").notNull(),
  isPublic: boolean("is_public").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const detectResults = pgTable(
  "detect_results",
  {
    runId: integer("run_id")
      .notNull()
      .references(() => evalRuns.id, { onDelete: "cascade" }),
    agentId: text("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    precision: real("precision").notNull(),
    recall: real("recall").notNull(),
    f1: real("f1").notNull(),
    f1CiLow: real("f1_ci_low").notNull(),
    f1CiHigh: real("f1_ci_high").notNull(),
    costUsdPerTask: real("cost_usd_per_task").notNull(),
    nTasks: integer("n_tasks").notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.runId, t.agentId] }) })
);

export const exploitResults = pgTable(
  "exploit_results",
  {
    runId: integer("run_id")
      .notNull()
      .references(() => evalRuns.id, { onDelete: "cascade" }),
    agentId: text("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    success: real("success").notNull(),
    partial: real("partial").notNull(),
    fail: real("fail").notNull(),
    costUsdPerTask: real("cost_usd_per_task").notNull(),
    nTasks: integer("n_tasks").notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.runId, t.agentId] }) })
);

export const fpRates = pgTable(
  "fp_rates",
  {
    runId: integer("run_id")
      .notNull()
      .references(() => evalRuns.id, { onDelete: "cascade" }),
    agentId: text("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    rate: real("rate").notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.runId, t.agentId, t.category] }) })
);

export type Agent = typeof agents.$inferSelect;
export type EvalRun = typeof evalRuns.$inferSelect;
export type DetectResult = typeof detectResults.$inferSelect;
export type ExploitResult = typeof exploitResults.$inferSelect;
export type FpRate = typeof fpRates.$inferSelect;
