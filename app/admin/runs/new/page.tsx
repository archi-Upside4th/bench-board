import { db } from "@/db";
import { agents } from "@/db/schema";
import { asc } from "drizzle-orm";
import { RunCreateForm } from "./RunCreateForm";

export const dynamic = "force-dynamic";

export default async function NewRunPage() {
  const all = await db.select().from(agents).orderBy(asc(agents.id));
  return <RunCreateForm allAgents={all} />;
}
