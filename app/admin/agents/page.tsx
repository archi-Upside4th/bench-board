import { db } from "@/db";
import { agents, detectResults } from "@/db/schema";
import { asc, count, eq, sql } from "drizzle-orm";
import { deleteAgent } from "@/lib/actions";
import { AgentForm } from "./AgentForm";

export const dynamic = "force-dynamic";

export default async function AgentsAdmin() {
  const rows = await db.select().from(agents).orderBy(asc(agents.id));

  // participation count: how many distinct runs each agent appears in
  const participationRows = await db
    .select({
      agentId: detectResults.agentId,
      runs: sql<number>`count(distinct ${detectResults.runId})`.as("runs"),
    })
    .from(detectResults)
    .groupBy(detectResults.agentId);

  const participation = new Map(
    participationRows.map((r) => [r.agentId, Number(r.runs)])
  );

  const vendors = Array.from(new Set(rows.map((r) => r.vendor))).sort();

  return (
    <div className="wrap adm-wrap" style={{ maxWidth: 1080 }}>
      <h1 className="adm-h1">Agents</h1>
      <p className="lede" style={{ marginTop: 12, maxWidth: "64ch" }}>
        Each evaluated model is one row. The <code>id</code> is the foreign key
        used by every result table, so don't rename it after results are imported —
        delete and re-add if you have to.
      </p>

      <section className="adm-section">
        <h2 className="adm-h2">Add / update</h2>
        <div style={{ marginTop: 16 }}>
          <AgentForm vendors={vendors} />
        </div>
      </section>

      <section className="adm-section">
        <h2 className="adm-h2">Current agents ({rows.length})</h2>
        <table className="adm-table" style={{ marginTop: 16 }}>
          <thead>
            <tr>
              <th>Agent</th>
              <th>Vendor</th>
              <th>Release</th>
              <th>Color</th>
              <th>Runs participated</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => {
              const count = participation.get(a.id) ?? 0;
              return (
                <tr key={a.id}>
                  <td>
                    <div className="agent-cell">
                      <span className="agent-swatch" style={{ background: a.color, width: 14, height: 14, borderRadius: 4 }} />
                      <span className="agent-name">{a.id}</span>
                    </div>
                  </td>
                  <td className="vendor">{a.vendor}</td>
                  <td className="num-col">{a.releaseDate}</td>
                  <td className="mono" style={{ fontSize: 11.5 }}>{a.color}</td>
                  <td className="num-col">{count}</td>
                  <td>
                    <form action={deleteAgent}>
                      <input type="hidden" name="id" value={a.id} />
                      <button
                        className="ghost-btn"
                        type="submit"
                        style={{ color: count > 0 ? "var(--mute)" : "var(--bad)", height: 28, padding: "0 10px", fontSize: 12 }}
                        title={count > 0 ? `In ${count} run(s) — deletion will cascade` : "Delete agent"}
                      >
                        Delete
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
