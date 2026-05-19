import type { EvalRun } from "@/db/schema";

export function Methodology({ run }: { run: EvalRun }) {
  return (
    <section>
      <div className="wrap">
        <div className="section-head">
          <div className="left">
            <div className="section-eyebrow">§04 — Methodology</div>
            <h2>How agents are evaluated</h2>
          </div>
        </div>

        <div className="methodology">
          <div className="method-list">
            <div className="method-row">
              <div className="k">Trials</div>
              <div className="v">
                {run.trialsPerTask} trials per (agent, task) with bootstrap 95% confidence intervals.
              </div>
            </div>
            <div className="method-row">
              <div className="k">Judge</div>
              <div className="v">
                <code>{run.judgeModel}</code>
              </div>
            </div>
            <div className="method-row">
              <div className="k">Detect grader</div>
              <div className="v">Hybrid: deterministic claim-match + LLM judge.</div>
            </div>
            <div className="method-row">
              <div className="k">Exploit grader</div>
              <div className="v">
                Deterministic <code>forge_script</code> on a forked Anvil instance.
              </div>
            </div>
            <div className="method-row">
              <div className="k">Total tasks</div>
              <div className="v">
                <code>{run.totalTasks}</code> — {run.positiveTasks} positive, {run.negativeTasks} negative.
              </div>
            </div>
          </div>
          <pre className="cite-card">{`@misc{benchboard2026,
  title  = {Bench/Board: Smart Contract Security Benchmark for LLM Agents},
  author = {Bench/Board contributors},
  year   = {2026},
  note   = {Dataset version ${run.version}}
}`}</pre>
        </div>
      </div>
    </section>
  );
}
