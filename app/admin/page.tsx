import { db } from "@/db";
import { agents, evalRuns } from "@/db/schema";
import { desc } from "drizzle-orm";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const [agentRows, runRows] = await Promise.all([
    db.select().from(agents),
    db.select().from(evalRuns).orderBy(desc(evalRuns.createdAt)).limit(20),
  ]);

  return (
    <div className="wrap" style={{ paddingTop: 56, paddingBottom: 80 }}>
      <h1 style={{ fontSize: 28, margin: 0 }}>Dashboard</h1>
      <p className="lede" style={{ marginTop: 12 }}>
        {agentRows.length} agents · {runRows.length} runs
      </p>

      <div className="grid-2" style={{ marginTop: 40 }}>
        <div className="lb-card" style={{ padding: 20 }}>
          <h3>Recent runs</h3>
          {runRows.length === 0 ? (
            <p className="lede">
              No runs yet — <Link href="/admin/runs/new">import one</Link>.
            </p>
          ) : (
            <table className="lb">
              <thead>
                <tr>
                  <th>Version</th>
                  <th>Run ID</th>
                  <th>Created</th>
                  <th>Public</th>
                </tr>
              </thead>
              <tbody>
                {runRows.map((r) => (
                  <tr key={r.id}>
                    <td className="num-col">{r.version}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{r.runId}</td>
                    <td className="num-col" style={{ color: "var(--mute)" }}>
                      {new Date(r.createdAt).toISOString().slice(0, 10)}
                    </td>
                    <td>{r.isPublic ? "✓" : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="lb-card" style={{ padding: 20 }}>
          <h3>Agents</h3>
          {agentRows.length === 0 ? (
            <p className="lede">
              No agents yet — <Link href="/admin/agents">add one</Link>.
            </p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {agentRows.map((a) => (
                <li key={a.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--line-soft)" }}>
                  <span className="agent-swatch" style={{ background: a.color, display: "inline-block", marginRight: 10 }} />
                  <span className="agent-name">{a.id}</span>
                  <span className="vendor" style={{ marginLeft: 12 }}>{a.vendor}</span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/admin/agents" className="ghost-btn" style={{ marginTop: 16 }}>
            Manage agents
          </Link>
        </div>
      </div>
    </div>
  );
}
