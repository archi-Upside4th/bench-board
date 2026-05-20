import { config } from "dotenv";
config({ path: ".env.local" });
import { db } from "../src/db";
import { agents, customAgents } from "../src/db/schema";
import { eq } from "drizzle-orm";

// Same vendor detection logic as actions.ts
function vendorFromModel(model: string): string {
  const m = model.toLowerCase();
  if (m.startsWith("openai/")) return "OpenAI";
  if (m.startsWith("anthropic/")) return "Anthropic";
  if (m.startsWith("google/")) return "Google";
  if (m.startsWith("deepseek/")) return "DeepSeek";
  if (m.startsWith("alibaba/") || m.startsWith("qwen/")) return "Alibaba";
  if (m.startsWith("meta/") || m.startsWith("meta-llama/")) return "Meta";
  if (m.startsWith("mistralai/") || m.startsWith("mistral/")) return "Mistral";
  if (m.startsWith("x-ai/")) return "xAI";
  if (m.startsWith("cohere/")) return "Cohere";
  if (m.startsWith("perplexity/")) return "Perplexity";
  if (m.includes("claude")) return "Anthropic";
  if (m.includes("gpt") || /\bo[134]\b/.test(m) || m.includes("openai")) return "OpenAI";
  if (m.includes("gemini") || m.includes("palm") || m.includes("bard")) return "Google";
  if (m.includes("deepseek")) return "DeepSeek";
  if (m.includes("qwen")) return "Alibaba";
  if (m.includes("llama")) return "Meta";
  if (m.includes("mistral") || m.includes("mixtral")) return "Mistral";
  if (m.includes("grok")) return "xAI";
  if (m.includes("command-r") || m.includes("command-")) return "Cohere";
  const slash = model.indexOf("/");
  if (slash > 0) return model.slice(0, slash).replace(/^./, (c) => c.toUpperCase());
  return "Unknown";
}

async function backfillTable(name: string, tbl: typeof agents | typeof customAgents) {
  const rows = await db.select().from(tbl);
  let updated = 0;
  for (const r of rows) {
    if (r.vendor && r.vendor !== "Unknown") continue;
    const v = vendorFromModel(r.id);
    if (v === "Unknown") continue;
    await db.update(tbl).set({ vendor: v }).where(eq(tbl.id, r.id));
    console.log(`  ${name} ${r.id}: '${r.vendor}' → '${v}'`);
    updated++;
  }
  console.log(`  → updated ${updated} of ${rows.length} in ${name}`);
}

async function main() {
  console.log("Backfilling agents:");
  await backfillTable("agents", agents);
  console.log("Backfilling custom_agents:");
  await backfillTable("custom_agents", customAgents);
  process.exit(0);
}
main();
