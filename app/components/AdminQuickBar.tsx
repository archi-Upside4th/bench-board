import Link from "next/link";

type Props = { runId?: number };

export function AdminQuickBar({ runId }: Props) {
  return (
    <div
      style={{
        position: "fixed",
        bottom: 18,
        right: 18,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "6px",
        background: "var(--bg-card)",
        border: "1px solid var(--line)",
        borderRadius: 999,
        boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
        fontFamily: "var(--sans)",
        fontSize: 12,
      }}
      aria-label="Admin quick actions"
    >
      <span style={{ padding: "0 10px", color: "var(--mute)", fontFamily: "var(--mono)", fontSize: 11, letterSpacing: 0.05 }}>
        admin
      </span>
      <Link
        href="/admin/site"
        style={pillStyle}
      >
        Edit text
      </Link>
      {runId !== undefined ? (
        <Link href={`/admin/runs/${runId}`} style={pillStyle}>
          Edit data
        </Link>
      ) : null}
      <Link href="/admin" style={pillStyle}>
        Dashboard
      </Link>
    </div>
  );
}

const pillStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  height: 28,
  padding: "0 12px",
  borderRadius: 999,
  background: "var(--bg-elev)",
  color: "var(--ink)",
  textDecoration: "none",
  border: "1px solid var(--line)",
  whiteSpace: "nowrap",
};
