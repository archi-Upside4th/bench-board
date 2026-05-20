import { config } from "dotenv";
config({ path: ".env.local" });
import { db } from "../src/db";
import { siteSettings } from "../src/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const r = await db
    .update(siteSettings)
    .set({ leaderboardLede: "Detect mode = F1 · Exploit mode = success rate." })
    .where(eq(siteSettings.id, 1))
    .returning({ lede: siteSettings.leaderboardLede });
  console.log("Updated:", r);
  process.exit(0);
}
main();
