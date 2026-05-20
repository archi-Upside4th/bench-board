import { config } from "dotenv";
config({ path: ".env.local" });

import { db } from "../src/db";
import { siteSettings } from "../src/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const r = await db
    .update(siteSettings)
    .set({
      paretoTitle: "Reasoning frontier",
      paretoLede:
        "Each point is one agent. X = mean reasoning tokens spent per task; Y = detection F1. Look for agents that score high with the fewest tokens.",
      paretoQuote:
        "**More thinking ≠ more accuracy.** The frontier exposes which models actually convert reasoning effort into better detection.",
      paretoBody:
        "Top-left agents hit competitive F1 with surprisingly little reasoning. Models drifting right of the frontier are burning tokens for marginal gain — a signal that bigger think-time isn't paying off.",
    })
    .where(eq(siteSettings.id, 1))
    .returning({ title: siteSettings.paretoTitle });
  console.log("Updated:", r);
  process.exit(0);
}
main();
