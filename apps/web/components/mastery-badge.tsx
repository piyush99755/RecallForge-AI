import React from "react";
import { formatMasteryLevel } from "@/lib/formatters";

interface MasteryBadgeProps {
  level: string | null | undefined;
  className?: string;
}

export function MasteryBadge({ level, className = "" }: MasteryBadgeProps) {
  const normalized = (level || "weak").toLowerCase();

  let colorClasses =
    "bg-muted text-muted-foreground border-border";

  if (normalized === "weak") {
    colorClasses =
      "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20";
  } else if (normalized === "developing") {
    colorClasses =
      "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20";
  } else if (normalized === "strong") {
    colorClasses =
      "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20";
  } else if (normalized === "mastered") {
    colorClasses =
      "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20";
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold uppercase tracking-wider border ${colorClasses} ${className}`}
    >
      {formatMasteryLevel(level)}
    </span>
  );
}
