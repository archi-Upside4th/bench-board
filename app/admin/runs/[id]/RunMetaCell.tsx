"use client";

import { InlineCell } from "./InlineCell";
import { updateRunMetaNumber } from "@/lib/actions";

/**
 * Wrapper so the inline `fmt` closure is created on the client side and
 * doesn't have to cross the Server→Client component boundary as a prop.
 */
export function RunMetaIntCell({
  value,
  runId,
  field,
}: {
  value: number;
  runId: number;
  field: "trialsPerTask" | "totalTasks" | "positiveTasks" | "negativeTasks" | "categoriesCount";
}) {
  return (
    <InlineCell
      initial={value}
      fmt={(v) => String(Math.round(v))}
      action={updateRunMetaNumber}
      actionInput={{ id: runId, field }}
      width={80}
      align="left"
    />
  );
}
