import { db } from "@/db";
import { agents, evalRuns, detectResults } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const [agentRows, runRows] = await Promise.all([
    db.select().from(agents),
    db.select().from(evalRuns).orderBy(desc(evalRuns.createdAt)).limit(20),
  ]);

  // Fetch detect results for the 2 most recent public runs (for top-3 preview + delta)
  const publicRuns = runRows.filter((r) => r.isPublic);
  const latestPublic = publicRuns[0];
  const previousPublic = publicRuns[1];

  const [latestDetect, prevDetect] = await Promise.all([
    latestPublic
      ? db.select().from(detectResults).where(eq(detectResults.runId, latestPublic.id))
      : Promise.resolve([]),
    previousPublic
      ? db.select().from(detectResults).where(eq(detectResults.runId, previousPublic.id))
      : Promise.resolve([]),
  ]);

  const agentById = new Map(agentRows.map((a) => [a.id, a]));
  const latestSorted = [...latestDetect].sort((a, b) => b.f1 - a.f1).slice(0, 3);
  const prevF1ById = new Map(prevDetect.map((r) => [r.agentId, r.f1]));

  const lastImportAt = runRows[0]?.createdAt;

  return (
    <div className="wrap adm-wrap" style={{ maxWidth: 1280 }}>
      <div className="adm-row between">
        <div>
          <h1 className="adm-h1">Dashboard</h1>
          <p className="lede" style={{ marginTop: 8 }}>
            {agentRows.length} agents · {runRows.length} runs · {publicRuns.length} public
            {lastImportAt ? (
              <> · last import {new Date(lastImportAt).toISOString().slice(0, 10)}</>
            ) : null}
          </p>
        </div>
        <div className="adm-row" style={{ flexWrap: "wrap", gap: 8 }}>
          <Link href="/" className="ghost-btn">View site</Link>
          <Link href="/admin/agents" className="ghost-btn">Agents</Link>
          <Link href="/admin/runs/new" className="ghost-btn">New run (manual)</Link>
          <Link href="/admin/runs/import-trials" className="primary-btn">+ Import data</Link>
        </div>
      </div>

      {latestPublic ? (
        <section className="adm-section">
          <div className="adm-row between">
            <h2 className="adm-h2">
              Top of <span className="mono" style={{ color: "var(--ink)" }}>{latestPublic.version}</span>
            </h2>
            <Link href={`/admin/runs/${latestPublic.id}`} className="ghost-btn">Open run</Link>
          </div>
          {latestSorted.length === 0 ? (
            <p className="lede" style={{ marginTop: 12 }}>No detect results in this run.</p>
          ) : (
            <table className="adm-table" style={{ marginTop: 16 }}>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Agent</th>
                  <th className="num">F1</th>
                  {previousPublic ? (
                    <th className="num">
                      vs <span className="mono">{previousPublic.version}</span>
                    </th>
                  ) : null}
                  <th className="num">$/task</th>
                </tr>
              </thead>
              <tbody>
                {latestSorted.map((r, i) => {
                  const a = agentById.get(r.agentId);
                  const prev = prevF1ById.get(r.agentId);
                  const delta = prev !== undefined ? r.f1 - prev : null;
                  return (
                    <tr key={r.agentId}>
                      <td className="rank-col">{String(i + 1).padStart(2, "0")}</td>
                      <td>
                        <div className="agent-cell">
                          <span className="agent-swatch" style={{ background: a?.color }} />
                          <span className="agent-name">{r.agentId}</span>
                        </div>
                      </td>
                      <td className="num num-col">{r.f1.toFixed(2)}</td>
                      {previousPublic ? (
                        <td className="num">
                          {delta === null ? (
                            <span className="adm-delta flat">new</span>
                          ) : Math.abs(delta) < 0.005 ? (
                            <span className="adm-delta flat">±0.00</span>
                          ) : delta > 0 ? (
                            <span className="adm-delta up">+{delta.toFixed(2)}</span>
                          ) : (
                            <span className="adm-delta down">{delta.toFixed(2)}</span>
                          )}
                        </td>
                      ) : null}
                      <td className="num num-col">${r.costUsdPerTask.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      ) : (
        <section className="adm-section">
          <div className="adm-banner">
            No public runs yet. <Link href="/admin/runs/new">Create one</Link> to make the
            home page live.
          </div>
        </section>
      )}

      <section className="adm-section">
        <h2 className="adm-h2">All runs</h2>
        {runRows.length === 0 ? (
          <p className="lede" style={{ marginTop: 12 }}>
            No runs yet — <Link href="/admin/runs/new">import one</Link>.
          </p>
        ) : (
          <table className="adm-table" style={{ marginTop: 16 }}>
            <thead>
              <tr>
                <th>Version</th>
                <th>Run ID</th>
                <th>Created</th>
                <th>Visibility</th>
                <th>Judge</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {runRows.map((r) => (
                <tr key={r.id}>
                  <td className="num-col" style={{ fontWeight: 600 }}>{r.version}</td>
                  <td className="mono" style={{ fontSize: 11.5, color: "var(--mute)" }}>{r.runId}</td>
                  <td className="num-col" style={{ color: "var(--mute)" }}>
                    {new Date(r.createdAt).toISOString().slice(0, 10)}
                  </td>
                  <td>
                    <span className={`adm-status ${r.isPublic ? "public" : "hidden"}`}>
                      {r.isPublic ? "public" : "hidden"}
                    </span>
                  </td>
                  <td className="mono" style={{ fontSize: 11, color: "var(--mute-2)", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.judgeModel}
                  </td>
                  <td>
                    <Link href={`/admin/runs/${r.id}`} className="ghost-btn" style={{ height: 28, padding: "0 10px", fontSize: 12 }}>
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
