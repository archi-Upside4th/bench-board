import { getSiteSettings } from "@/lib/settings";
import { SiteSettingsForm } from "./SiteSettingsForm";
import type { SiteSettingsInput } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function SitePage() {
  const s = await getSiteSettings();

  const initial: SiteSettingsInput = {
    brandLeft: s.brandLeft,
    brandRight: s.brandRight,
    siteSubtitle: s.siteSubtitle,
    githubUrl: s.githubUrl,
    heroEyebrow: s.heroEyebrow,
    heroTitle: s.heroTitle,
    heroDescription: s.heroDescription,
    heroStat1Label: s.heroStat1Label,
    heroStat2Label: s.heroStat2Label,
    heroStat3Label: s.heroStat3Label,
    heroStat4Label: s.heroStat4Label,
    leaderboardTitle: s.leaderboardTitle,
    leaderboardLede: s.leaderboardLede,
    paretoTitle: s.paretoTitle,
    paretoLede: s.paretoLede,
    paretoQuote: s.paretoQuote,
    paretoBody: s.paretoBody,
    fpTitle: s.fpTitle,
    fpLede: s.fpLede,
    methodologyTitle: s.methodologyTitle,
    methodologyDetectGrader: s.methodologyDetectGrader,
    methodologyExploitGrader: s.methodologyExploitGrader,
    citeBibtex: s.citeBibtex,
    aboutTitle: s.aboutTitle,
    aboutLede: s.aboutLede,
    footerCopyright: s.footerCopyright,
  };

  return (
    <div className="wrap adm-wrap" style={{ maxWidth: 960 }}>
      <h1 className="adm-h1">Site text</h1>
      <p className="lede" style={{ marginTop: 8, maxWidth: "70ch" }}>
        Every editable label, heading, and paragraph on the public site is here.
        Click a group to expand. Changes go live on the next page load.
        <br />
        <span style={{ color: "var(--mute-2)" }}>
          Tip: a few fields support <code>**bold**</code> markdown for emphasis.
        </span>
      </p>
      <SiteSettingsForm initial={initial} />
    </div>
  );
}
