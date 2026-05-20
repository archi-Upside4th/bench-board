import { config } from "dotenv";
config({ path: ".env.local" });

import { db } from "../src/db";
import { siteSettings } from "../src/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const r = await db
    .update(siteSettings)
    .set({
      leaderboardTitle: "LLM ranking",
      agentRankingTitle: "Agent ranking",
      agentRankingLede:
        "Custom coding agents and frameworks built on top of LLMs — Claude Code, Codex, V12, Sherlock, etc.",
    })
    .where(eq(siteSettings.id, 1))
    .returning({
      lb: siteSettings.leaderboardTitle,
      ar: siteSettings.agentRankingTitle,
    });
  console.log("Updated:", r);
  process.exit(0);
}
main();
