import { getSiteSettings } from "@/lib/settings";
import { SiteSettingsForm } from "./SiteSettingsForm";
import type { SiteSettingsInput } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function SitePage() {
  const s = await getSiteSettings();

  const initial: SiteSettingsInput = {
    siteSubtitle: s.siteSubtitle,
    githubUrl: s.githubUrl,
    heroEyebrow: s.heroEyebrow,
    heroTitle: s.heroTitle,
    heroDescription: s.heroDescription,
    leaderboardLede: s.leaderboardLede,
    paretoLede: s.paretoLede,
    paretoQuote: s.paretoQuote,
    paretoBody: s.paretoBody,
    fpLede: s.fpLede,
    methodologyDetectGrader: s.methodologyDetectGrader,
    methodologyExploitGrader: s.methodologyExploitGrader,
    citeBibtex: s.citeBibtex,
    aboutLede: s.aboutLede,
    footerCopyright: s.footerCopyright,
  };

  return (
    <div className="wrap adm-wrap" style={{ maxWidth: 960 }}>
      <h1 className="adm-h1">Site text</h1>
      <p className="lede" style={{ marginTop: 8, maxWidth: "64ch" }}>
        Editable copy that appears on the public leaderboard. Changes go live
        on next page load. <code>**bold**</code> syntax is rendered as bold
        text in some fields.
      </p>
      <SiteSettingsForm initial={initial} />
    </div>
  );
}
