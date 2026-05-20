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

/**
 * Custom coding agents (Claude Code, Codex, V12, Sherlock, etc.) —
 * separate from raw LLM `agents` so they can be ranked independently.
 */
export const customAgents = pgTable("custom_agents", {
  id: text("id").primaryKey(),
  vendor: text("vendor").notNull(),
  releaseDate: text("release_date").notNull(),
  color: text("color").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Detect-mode results for custom agents.
export const customAgentResults = pgTable(
  "custom_agent_results",
  {
    runId: integer("run_id")
      .notNull()
      .references(() => evalRuns.id, { onDelete: "cascade" }),
    agentId: text("agent_id")
      .notNull()
      .references(() => customAgents.id, { onDelete: "cascade" }),
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

// FP rates per (run, custom_agent, category) — sibling of fp_rates.
export const customAgentFpRates = pgTable(
  "custom_agent_fp_rates",
  {
    runId: integer("run_id")
      .notNull()
      .references(() => evalRuns.id, { onDelete: "cascade" }),
    agentId: text("agent_id")
      .notNull()
      .references(() => customAgents.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    rate: real("rate").notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.runId, t.agentId, t.category] }) })
);

// Exploit-mode results for custom agents (success/partial/fail rates).
export const customAgentExploitResults = pgTable(
  "custom_agent_exploit_results",
  {
    runId: integer("run_id")
      .notNull()
      .references(() => evalRuns.id, { onDelete: "cascade" }),
    agentId: text("agent_id")
      .notNull()
      .references(() => customAgents.id, { onDelete: "cascade" }),
    success: real("success").notNull(),
    partial: real("partial").notNull(),
    fail: real("fail").notNull(),
    costUsdPerTask: real("cost_usd_per_task").notNull(),
    nTasks: integer("n_tasks").notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.runId, t.agentId] }) })
);

/**
 * Standalone reasoning-effort vs F1 data — fully decoupled from
 * detect_results so admins can populate it independently (different
 * agents, different cadence). Powers the Pareto/Reasoning frontier chart.
 */
export const reasoningPoints = pgTable(
  "reasoning_points",
  {
    runId: integer("run_id")
      .notNull()
      .references(() => evalRuns.id, { onDelete: "cascade" }),
    agentId: text("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    f1: real("f1").notNull(),
    reasoningTokensPerTask: real("reasoning_tokens_per_task").notNull(),
    nTasks: integer("n_tasks").notNull().default(0),
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

/**
 * Persistent per-trial records. Appended on every JSON paste in
 * /admin/runs/import-trials and re-aggregated on each import into the chosen
 * output run's detect_results / exploit_results.
 */
export const rawTrials = pgTable("raw_trials", {
  id: serial("id").primaryKey(),
  agentId: text("agent_id")
    .notNull()
    .references(() => agents.id, { onDelete: "cascade" }),
  mode: text("mode").notNull(), // "detect" | "exploit"
  task: text("task"),
  // Detect fields
  tpFindings: integer("tp_findings"),
  fpFindings: integer("fp_findings"),
  fnFindings: integer("fn_findings"),
  // Exploit fields
  label: text("label"),
  // Both
  costUsd: real("cost_usd"),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  reasoningTokens: integer("reasoning_tokens"),
  cachedTokens: integer("cached_tokens"),
  ts: text("ts"),
  sourceRunId: text("source_run_id"),
  importedAt: timestamp("imported_at", { withTimezone: true }).defaultNow().notNull(),
});

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
  heroStat2Label: text("hero_stat_2_label").notNull().default("Total trials"),
  heroStat3Label: text("hero_stat_3_label").notNull().default("Agents evaluated"),
  heroStat4Label: text("hero_stat_4_label").notNull().default("Trials per task"),

  // Section H2 titles
  leaderboardTitle: text("leaderboard_title").notNull().default("LLM ranking"),
  leaderboardLede: text("leaderboard_lede").notNull().default(
    "Detect mode = F1 · Exploit mode = success rate."
  ),

  // Custom-agent (Claude Code / Codex / etc.) ranking section
  agentRankingTitle: text("agent_ranking_title").notNull().default("Agent ranking"),
  agentRankingLede: text("agent_ranking_lede").notNull().default(
    "Custom agents and frameworks built on top of LLMs"
  ),

  paretoTitle: text("pareto_title").notNull().default("Reasoning frontier"),
  paretoLede: text("pareto_lede").notNull().default(
    "Each point is one agent. X = mean reasoning tokens spent per task; Y = detection F1. Look for agents that score high with the fewest tokens."
  ),
  paretoQuote: text("pareto_quote").notNull().default(
    "**More thinking ≠ more accuracy.** The frontier exposes which models actually convert reasoning effort into better detection."
  ),
  paretoBody: text("pareto_body").notNull().default(
    "Top-left agents hit competitive F1 with surprisingly little reasoning. Models drifting right of the frontier are burning tokens for marginal gain — a signal that bigger think-time isn't paying off."
  ),

  fpTitle: text("fp_title").notNull().default("FP rate on hardened decoys"),
  fpLede: text("fp_lede").notNull().default(
    "Lower is better. How often each model raises a vulnerability that isn't actually there."
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
export type RawTrial = typeof rawTrials.$inferSelect;
export type ReasoningPoint = typeof reasoningPoints.$inferSelect;
export type CustomAgent = typeof customAgents.$inferSelect;
export type CustomAgentResult = typeof customAgentResults.$inferSelect;
export type CustomAgentExploitResult = typeof customAgentExploitResults.$inferSelect;
export type CustomAgentFpRate = typeof customAgentFpRates.$inferSelect;
