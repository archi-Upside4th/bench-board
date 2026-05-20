import { config } from "dotenv";
config({ path: ".env.local" });
import { db } from "../src/db";
import { siteSettings } from "../src/db/schema";

async function main() {
  const [r] = await db.select({ lede: siteSettings.fpLede }).from(siteSettings);
  console.log("Current fpLede:", JSON.stringify(r));
  process.exit(0);
}
main();
