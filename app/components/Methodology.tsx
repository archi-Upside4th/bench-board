import type { EvalRun } from "@/db/schema";

type Props = {
  run: EvalRun;
  title: string;
  detectGrader: string;
  exploitGrader: string;
  citeBibtex: string;
};

export function Methodology({ run, title, detectGrader, exploitGrader, citeBibtex }: Props) {
  return (
    <section>
      <div className="wrap">
        <div className="section-head">
          <div className="left">
            <div className="section-eyebrow">Methodology</div>
            <h2>{title}</h2>
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
              <div className="v">{detectGrader}</div>
            </div>
            <div className="method-row">
              <div className="k">Exploit grader</div>
              <div className="v">{exploitGrader}</div>
            </div>
            <div className="method-row">
              <div className="k">Total tasks</div>
              <div className="v">
                <code>{run.totalTasks}</code> — {run.positiveTasks} positive, {run.negativeTasks} negative.
              </div>
            </div>
          </div>
          <pre className="cite-card">{citeBibtex}</pre>
        </div>
      </div>
    </section>
  );
}
