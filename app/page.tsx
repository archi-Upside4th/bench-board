import { getLatestRun } from "@/lib/leaderboard";
import { getSiteSettings } from "@/lib/settings";
import { auth, isAdmin } from "@/auth";
import { Header } from "./components/Header";
import { Hero } from "./components/Hero";
import { Leaderboard } from "./components/Leaderboard";
import { ParetoChart } from "./components/ParetoChart";
import { FpAnalysis } from "./components/FpAnalysis";
import { Methodology } from "./components/Methodology";
import { About } from "./components/About";
import { AdminQuickBar } from "./components/AdminQuickBar";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [data, s, session] = await Promise.all([getLatestRun(), getSiteSettings(), auth()]);
  const adminLogin = (session?.user as { login?: string } | undefined)?.login;
  const showAdminBar = isAdmin(adminLogin);

  if (!data) {
    return (
      <>
        <Header
          datasetVersion="—"
          subtitle={s.siteSubtitle}
          githubUrl={s.githubUrl}
          brandLeft={s.brandLeft}
          brandRight={s.brandRight}
        />
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
        {showAdminBar ? <AdminQuickBar /> : null}
      </>
    );
  }

  const { run, agents, detect, exploit, fpRows, fpCategories } = data;

  return (
    <>
      <Header
        datasetVersion={run.version}
        subtitle={s.siteSubtitle}
        githubUrl={s.githubUrl}
        brandLeft={s.brandLeft}
        brandRight={s.brandRight}
      />
      <main>
        <Hero
          eyebrow={s.heroEyebrow}
          title={s.heroTitle}
          description={s.heroDescription}
          stats={[
            { k: s.heroStat1Label, v: run.totalTasks, x: `dataset ${run.version}` },
            {
              k: s.heroStat2Label,
              v: run.totalTasks * run.trialsPerTask * agents.length,
              x: `${agents.length} agents × ${run.totalTasks} tasks × ${run.trialsPerTask} trials`,
            },
            { k: s.heroStat3Label, v: agents.length, x: "across vendors" },
            { k: s.heroStat4Label, v: run.trialsPerTask, x: run.judgeModel },
          ]}
        />
        <Leaderboard
          agents={agents}
          detect={detect}
          exploit={exploit}
          title={s.leaderboardTitle}
          lede={s.leaderboardLede}
        />
        <FpAnalysis
          agents={agents}
          categories={fpCategories}
          rows={fpRows}
          title={s.fpTitle}
          lede={s.fpLede}
        />
        <ParetoChart
          agents={agents}
          detect={detect}
          title={s.paretoTitle}
          lede={s.paretoLede}
          quote={s.paretoQuote}
          body={s.paretoBody}
        />
        <Methodology
          run={run}
          title={s.methodologyTitle}
          detectGrader={s.methodologyDetectGrader}
          exploitGrader={s.methodologyExploitGrader}
          citeBibtex={s.citeBibtex}
        />
        <About title={s.aboutTitle} lede={s.aboutLede} />
        <footer className="foot">
          <div className="wrap row">
            <span>{s.footerCopyright}</span>
            <span className="runid">dataset {run.version}</span>
          </div>
        </footer>
      </main>
      {showAdminBar ? <AdminQuickBar runId={run.id} /> : null}
    </>
  );
}
