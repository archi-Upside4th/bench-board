import { getLatestRun } from "@/lib/leaderboard";
import { getSiteSettings } from "@/lib/settings";
import { Header } from "./components/Header";
import { Hero } from "./components/Hero";
import { Leaderboard } from "./components/Leaderboard";
import { ParetoChart } from "./components/ParetoChart";
import { FpAnalysis } from "./components/FpAnalysis";
import { Methodology } from "./components/Methodology";
import { About } from "./components/About";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [data, s] = await Promise.all([getLatestRun(), getSiteSettings()]);

  if (!data) {
    return (
      <>
        <Header datasetVersion="—" subtitle={s.siteSubtitle} githubUrl={s.githubUrl} />
        <main>
          <section className="first">
            <div className="wrap">
              <div className="section-eyebrow" style={{ color: "var(--accent-hi)" }}>
                {s.heroEyebrow}
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
      <Header datasetVersion={run.version} subtitle={s.siteSubtitle} githubUrl={s.githubUrl} />
      <main>
        <Hero
          eyebrow={s.heroEyebrow}
          title={s.heroTitle}
          description={s.heroDescription}
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
        <Leaderboard agents={agents} detect={detect} exploit={exploit} lede={s.leaderboardLede} />
        <ParetoChart agents={agents} detect={detect} lede={s.paretoLede} quote={s.paretoQuote} body={s.paretoBody} />
        <FpAnalysis agents={agents} categories={fpCategories} rows={fpRows} lede={s.fpLede} />
        <Methodology
          run={run}
          detectGrader={s.methodologyDetectGrader}
          exploitGrader={s.methodologyExploitGrader}
          citeBibtex={s.citeBibtex}
        />
        <About lede={s.aboutLede} />
        <footer className="foot">
          <div className="wrap row">
            <span>{s.footerCopyright}</span>
            <span className="runid">dataset {run.version}</span>
          </div>
        </footer>
      </main>
    </>
  );
}
