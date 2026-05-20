import type { CustomAgent, CustomAgentResult } from "@/db/schema";

type Props = {
  agents: CustomAgent[];
  results: CustomAgentResult[];
  title: string;
  lede: string;
};

export function AgentRanking({ agents, results, title, lede }: Props) {
  const byId = new Map(agents.map((a) => [a.id, a]));
  const sorted = [...results].sort((a, b) => b.f1 - a.f1);

  return (
    <section>
      <div className="wrap">
        <div className="section-head">
          <div className="left">
            <h2>{title}</h2>
            <p className="lede">{lede}</p>
          </div>
        </div>

        <div className="lb-card">
          <div className="lb-scroll">
            {sorted.length === 0 ? (
              <div style={{ padding: 36, textAlign: "center", color: "var(--mute)", fontSize: 13.5, lineHeight: 1.6 }}>
                No custom-agent results yet for this run.
                <br />
                Add them in <a href="/admin">admin</a> → open the run → <b>Agent ranking</b> section.
              </div>
            ) : (
              <table className="lb">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Agent</th>
                    <th>Vendor</th>
                    <th>F1 (95% CI)</th>
                    <th className="num">Precision</th>
                    <th className="num">Recall</th>
                    <th className="num">$/task</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((r, i) => {
                    const a = byId.get(r.agentId);
                    const ci = ((r.f1CiHigh - r.f1CiLow) / 2).toFixed(2);
                    return (
                      <tr key={r.agentId} className={i === 0 ? "top" : ""}>
                        <td className="rank-col">{String(i + 1).padStart(2, "0")}</td>
                        <td>
                          <div className="agent-cell">
                            <span className="agent-swatch" style={{ background: a?.color }} />
                            <span className="agent-name">{r.agentId}</span>
                          </div>
                        </td>
                        <td className="vendor">{a?.vendor}</td>
                        <td className="num-col">
                          {r.f1.toFixed(2)}
                          <span className="ci">±{ci}</span>
                          <span className="bar-inline">
                            <i style={{ width: `${Math.round(r.f1 * 100)}%` }} />
                          </span>
                        </td>
                        <td className="num">{r.precision.toFixed(2)}</td>
                        <td className="num">{r.recall.toFixed(2)}</td>
                        <td className="num">${r.costUsdPerTask.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
