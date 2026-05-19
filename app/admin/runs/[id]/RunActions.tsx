"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setRunPublic, deleteRun } from "@/lib/actions";

export function RunActions({ runId, isPublic }: { runId: number; isPublic: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function togglePublic() {
    start(async () => {
      await setRunPublic(runId, !isPublic);
      router.refresh();
    });
  }

  function remove() {
    if (!confirm(`Delete run #${runId}? This cascades to all its results.`)) return;
    start(async () => {
      await deleteRun(runId);
      router.push("/admin");
    });
  }

  return (
    <div className="adm-row">
      <button className="ghost-btn" type="button" onClick={togglePublic} disabled={pending}>
        {isPublic ? "Hide from /" : "Publish to /"}
      </button>
      <button className="ghost-btn" type="button" onClick={remove} disabled={pending} style={{ color: "var(--bad)" }}>
        Delete run
      </button>
    </div>
  );
}
