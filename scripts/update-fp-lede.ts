import { config } from "dotenv";
config({ path: ".env.local" });
import { db } from "../src/db";
import { siteSettings } from "../src/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const r = await db
    .update(siteSettings)
    .set({ fpLede: "Lower is better. How often each model raises a vulnerability that isn't actually there." })
    .where(eq(siteSettings.id, 1))
    .returning({ lede: siteSettings.fpLede });
  console.log("Updated:", r);
  process.exit(0);
}
main();
