import { Fragment, type ReactNode } from "react";

/**
 * Render text with **markdown-style bold** segments.
 * `**word**` → <b style="color: var(--ink)">word</b>
 */
export function renderInline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith("**") && p.endsWith("**") && p.length >= 4) {
          return (
            <b key={i} style={{ color: "var(--ink)" }}>
              {p.slice(2, -2)}
            </b>
          );
        }
        return <Fragment key={i}>{p}</Fragment>;
      })}
    </>
  );
}
