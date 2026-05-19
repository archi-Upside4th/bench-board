import { getLatestRun } from "@/lib/leaderboard";
import { Header } from "./components/Header";
import { Hero } from "./components/Hero";
import { Leaderboard } from "./components/Leaderboard";
import { ParetoChart } from "./components/ParetoChart";
import { FpAnalysis } from "./components/FpAnalysis";
import { Methodology } from "./components/Methodology";
import { About } from "./components/About";

export const dynamic = "force-dynamic";

export default async function Page() {
  const data = await getLatestRun();

  if (!data) {
    return (
      <>
        <Header datasetVersion="—" />
        <main>
          <section className="first">
            <div className="wrap">
              <div className="section-eyebrow" style={{ color: "var(--accent-hi)" }}>
                Team benchclearing
              </div>
              <h1 style={{ fontSize: 38, margin: "16px 0 0" }}>No evaluation runs yet</h1>
              <p className="lede" style={{ marginTop: 24 }}>
                Sign in to <a href="/admin">/admin</a> and import your first eval run.
              </p>
            </div>
          </section>
        </main>
      </>
    );
  }

  const { run, agents, detect, exploit, fpRows, fpCategories } = data;

  return (
    <>
      <Header datasetVersion={run.version} />
      <main>
        <Hero
          eyebrow="Team benchclearing"
          stats={[
            { k: "Total tasks", v: run.totalTasks, x: `dataset ${run.version}` },
            {
              k: "Positive / Negative",
              v: run.positiveTasks,
              vSmall: ` / ${run.negativeTasks}`,
              x: `${Math.round((run.positiveTasks / run.totalTasks) * 100)}% positive`,
            },
            { k: "Agents evaluated", v: agents.length, x: "across vendors" },
            { k: "Trials per task", v: run.trialsPerTask, x: run.judgeModel },
          ]}
        />
        <Leaderboard agents={agents} detect={detect} exploit={exploit} />
        <ParetoChart agents={agents} detect={detect} />
        <FpAnalysis agents={agents} categories={fpCategories} rows={fpRows} />
        <Methodology run={run} />
        <About />
        <footer className="foot">
          <div className="wrap row">
            <span>© Team Benchclearing all rights reserved</span>
            <span className="runid">dataset {run.version}</span>
          </div>
        </footer>
      </main>
    </>
  );
}
