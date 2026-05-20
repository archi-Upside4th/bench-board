import { config } from "dotenv";
config({ path: ".env.local" });
import { db } from "../src/db";
import { customAgentResults } from "../src/db/schema";

async function main() {
  const deleted = await db
    .delete(customAgentResults)
    .returning({ runId: customAgentResults.runId, agentId: customAgentResults.agentId });
  console.log(`Deleted ${deleted.length} row(s) from custom_agent_results:`);
  for (const d of deleted) console.log(`  run #${d.runId} · ${d.agentId}`);
  process.exit(0);
}
main();
