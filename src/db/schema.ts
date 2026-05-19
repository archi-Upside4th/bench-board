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

/**
 * Singleton table — always exactly one row (id = 1) holding the editable
 * text content for the public site. Default values used as fallback if no
 * row exists yet.
 */
export const siteSettings = pgTable("site_settings", {
  id: integer("id").primaryKey().default(1),

  // Brand
  brandLeft: text("brand_left").notNull().default("Bench"),
  brandRight: text("brand_right").notNull().default("Board"),

  // Header
  siteSubtitle: text("site_subtitle").notNull().default("Smart Contract Security Benchmark for LLM Agents"),
  githubUrl: text("github_url").notNull().default("https://github.com/"),

  // Hero
  heroEyebrow: text("hero_eyebrow").notNull().default("Team benchclearing"),
  heroTitle: text("hero_title").notNull().default("Leaderboard"),
  heroDescription: text("hero_description").notNull().default(
    "Bench/Board evaluates LLM agents on smart-contract security tasks across two modes: **Detect** (vulnerability identification) and **Exploit** (proof-of-concept exploitation on forked chains)."
  ),

  // Hero stat card labels (the small caps text above each big number)
  heroStat1Label: text("hero_stat_1_label").notNull().default("Total tasks"),
  heroStat2Label: text("hero_stat_2_label").notNull().default("Positive / Negative"),
  heroStat3Label: text("hero_stat_3_label").notNull().default("Agents evaluated"),
  heroStat4Label: text("hero_stat_4_label").notNull().default("Trials per task"),

  // Section H2 titles
  leaderboardTitle: text("leaderboard_title").notNull().default("Agent ranking"),
  leaderboardLede: text("leaderboard_lede").notNull().default(
    "Switch modes to compare detection F1 vs exploit success rate. Confidence intervals from 3 trials × bootstrap."
  ),

  paretoTitle: text("pareto_title").notNull().default("Pareto frontier"),
  paretoLede: text("pareto_lede").notNull().default(
    "Each point is one agent. Higher and to the left is better — strong detection F1 at low per-task cost."
  ),
  paretoQuote: text("pareto_quote").notNull().default(
    "The frontier illustrates a clean cost–accuracy trade-off: **top-tier F1 doesn't require top-tier spend**."
  ),
  paretoBody: text("pareto_body").notNull().default(
    "The lowest-cost frontier agent achieves competitive F1 at a fraction of the cost of the top model — a meaningful trade if budget-sensitive deployment matters."
  ),

  fpTitle: text("fp_title").notNull().default("FP rate on hardened decoys"),
  fpLede: text("fp_lede").notNull().default(
    "Lower is better. Mean false-positive rate per agent across the negative categories."
  ),

  methodologyTitle: text("methodology_title").notNull().default("How agents are evaluated"),
  methodologyDetectGrader: text("methodology_detect_grader").notNull().default(
    "Hybrid: deterministic claim-match + LLM judge."
  ),
  methodologyExploitGrader: text("methodology_exploit_grader").notNull().default(
    "Deterministic forge_script on a forked Anvil instance."
  ),
  citeBibtex: text("cite_bibtex").notNull().default(
    `@misc{benchboard2026,\n  title  = {Bench/Board: Smart Contract Security Benchmark for LLM Agents},\n  author = {Bench/Board contributors},\n  year   = {2026}\n}`
  ),

  aboutTitle: text("about_title").notNull().default("About Bench/Board"),
  aboutLede: text("about_lede").notNull().default(
    "Bench/Board is an independent benchmark for LLM agents on Solidity security tasks, drawing on the data structure of EVMBench and the cost-aware framing of Aider's leaderboards."
  ),

  // Footer
  footerCopyright: text("footer_copyright").notNull().default("© Team Benchclearing all rights reserved"),

  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Agent = typeof agents.$inferSelect;
export type EvalRun = typeof evalRuns.$inferSelect;
export type DetectResult = typeof detectResults.$inferSelect;
export type ExploitResult = typeof exploitResults.$inferSelect;
export type FpRate = typeof fpRates.$inferSelect;
export type SiteSettings = typeof siteSettings.$inferSelect;
