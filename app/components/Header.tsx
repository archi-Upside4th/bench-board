type Props = {
  datasetVersion: string;
  subtitle: string;
  githubUrl: string;
  brandLeft: string;
  brandRight: string;
};

export function Header({ datasetVersion, subtitle, githubUrl, brandLeft, brandRight }: Props) {
  return (
    <header className="site">
      <div className="site-inner">
        <div className="brand">
          <a className="logo" href="/" aria-label="Bench/Board leaderboard">
            <span className="logomark">
              <img
                src="/brand-icon.png"
                alt=""
                width={28}
                height={28}
                style={{ display: "block", borderRadius: 7 }}
              />
            </span>
            <span className="wordmark">
              <span className="w-bench">{brandLeft}</span>
              <span className="w-dash">/</span>
              <span className="w-clear">{brandRight}</span>
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
