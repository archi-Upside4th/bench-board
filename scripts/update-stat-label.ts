import { config } from "dotenv";
config({ path: ".env.local" });

import { db } from "../src/db";
import { siteSettings } from "../src/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const r = await db
    .update(siteSettings)
    .set({ heroStat2Label: "Total trials" })
    .where(eq(siteSettings.id, 1))
    .returning({ label: siteSettings.heroStat2Label });
  console.log("Updated row:", r);
  process.exit(0);
}
main();
