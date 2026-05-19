import { db } from "@/db";
import { siteSettings, type SiteSettings } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Returns the singleton site_settings row. If the table is empty, inserts the
 * defaults row (with id = 1) and returns it. All defaults are declared on the
 * schema columns so we just insert an empty row to get them.
 */
export async function getSiteSettings(): Promise<SiteSettings> {
  const [existing] = await db.select().from(siteSettings).where(eq(siteSettings.id, 1)).limit(1);
  if (existing) return existing;
  const [created] = await db
    .insert(siteSettings)
    .values({ id: 1 })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  // Race: another request created it. Re-read.
  const [again] = await db.select().from(siteSettings).where(eq(siteSettings.id, 1)).limit(1);
  return again!;
}
