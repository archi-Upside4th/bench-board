"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upsertAgent } from "@/lib/actions";

const FALLBACK_COLORS = [
  "#D97757", "#10A37F", "#4285F4", "#7C3AED",
  "#FF6A00", "#E89B7C", "#5DC09F",
];

function pickColor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return FALLBACK_COLORS[h % FALLBACK_COLORS.length];
}

export function AgentForm({ vendors }: { vendors: string[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const [id, setId] = useState("");
  const [vendor, setVendor] = useState("");
  const [vendorNew, setVendorNew] = useState("");
  const [releaseDate, setReleaseDate] = useState(new Date().toISOString().slice(0, 7));
  const [color, setColor] = useState(pickColor(""));

  function onIdBlur() {
    if (id && color === pickColor("")) setColor(pickColor(id));
  }

  function submit() {
    setErr(null);
    const chosenVendor = vendor === "__new__" ? vendorNew.trim() : vendor.trim();
    if (!id.trim()) return setErr("Agent ID is required.");
    if (!chosenVendor) return setErr("Vendor is required.");
    if (!/^#[0-9A-Fa-f]{6}$/.test(color)) return setErr("Color must be a 6-digit hex value.");

    const fd = new FormData();
    fd.set("id", id.trim());
    fd.set("vendor", chosenVendor);
    fd.set("release_date", releaseDate.trim());
    fd.set("color", color);

    start(async () => {
      try {
        await upsertAgent(fd);
        setId("");
        setVendor("");
        setVendorNew("");
        setColor(pickColor(""));
        router.refresh();
      } catch (e) {
        setErr((e as Error).message);
      }
    });
  }

  return (
    <div>
      {err ? <div className="adm-banner err" style={{ marginBottom: 12 }}>{err}</div> : null}
      <div className="adm-grid cols-4">
        <div className="adm-field">
          <span className="adm-label">Agent ID</span>
          <input
            className="adm-input"
            value={id}
            onChange={(e) => setId(e.target.value)}
            onBlur={onIdBlur}
            placeholder="claude-opus-4-7"
            style={{ fontFamily: "var(--mono)" }}
          />
        </div>
        <div className="adm-field">
          <span className="adm-label">Vendor</span>
          {vendor === "__new__" ? (
            <input
              className="adm-input"
              value={vendorNew}
              onChange={(e) => setVendorNew(e.target.value)}
              placeholder="New vendor name"
              autoFocus
            />
          ) : (
            <select
              className="adm-select"
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
            >
              <option value="">Select vendor…</option>
              {vendors.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
              <option value="__new__">+ Add new vendor</option>
            </select>
          )}
        </div>
        <div className="adm-field">
          <span className="adm-label">Release (YYYY-MM)</span>
          <input
            className="adm-input"
            value={releaseDate}
            onChange={(e) => setReleaseDate(e.target.value)}
            placeholder="2026-03"
          />
        </div>
        <div className="adm-field">
          <span className="adm-label">Color</span>
          <div className="adm-row">
            <input
              type="color"
              className="adm-color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />
            <input
              className="adm-input"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              style={{ fontFamily: "var(--mono)", width: 110 }}
            />
          </div>
        </div>
      </div>
      <div style={{ marginTop: 16 }}>
        <button type="button" className="primary-btn" onClick={submit} disabled={pending}>
          {pending ? "Saving…" : "Save agent"}
        </button>
      </div>
    </div>
  );
}
