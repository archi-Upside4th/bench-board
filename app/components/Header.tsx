type Props = {
  datasetVersion: string;
  subtitle: string;
  githubUrl: string;
};

export function Header({ datasetVersion, subtitle, githubUrl }: Props) {
  return (
    <header className="site">
      <div className="site-inner">
        <div className="brand">
          <a className="logo" href="/" aria-label="Bench/Board leaderboard">
            <span className="logomark">
              <svg viewBox="0 0 28 28" width="28" height="28" fill="none">
                <rect x="1" y="1" width="26" height="26" rx="7" fill="#1c1c22" stroke="url(#lgmg)" strokeWidth="1.4" />
                <rect x="7" y="8" width="11" height="2.4" rx="1.2" fill="#5eead4" />
                <rect x="7" y="12.8" width="15" height="2.4" rx="1.2" fill="#14b8a6" />
                <rect x="7" y="17.6" width="8" height="2.4" rx="1.2" fill="#22d3ee" opacity="0.65" />
                <defs>
                  <linearGradient id="lgmg" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor="#2dd4bf" />
                    <stop offset="1" stopColor="#22d3ee" />
                  </linearGradient>
                </defs>
              </svg>
            </span>
            <span className="wordmark">
              <span className="w-bench">Bench</span>
              <span className="w-dash">/</span>
              <span className="w-clear">Board</span>
            </span>
          </a>
          <span className="sub">{subtitle}</span>
        </div>
        <span className="header-spacer" />
        <span className="meta-pill" title="Dataset version">
          dataset <b>{datasetVersion}</b>
        </span>
        <span className="meta-pill" title="Last updated">
          updated <b>{new Date().toISOString().slice(0, 10)}</b>
        </span>
        {githubUrl ? (
          <a className="ghost-btn" href={githubUrl} target="_blank" rel="noreferrer">
            View on GitHub
          </a>
        ) : null}
      </div>
    </header>
  );
}
