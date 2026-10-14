import React from "react";
import { Clock, AlertTriangle, Calendar, CheckCircle2 } from "lucide-react";

interface ReviewStatusBadgeProps {
  status: string | null | undefined;
  className?: string;
}

export function ReviewStatusBadge({
  status,
  className = "",
}: ReviewStatusBadgeProps) {
  const normalized = (status || "not_scheduled").toLowerCase();

  switch (normalized) {
    case "overdue":
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold uppercase tracking-wider bg-rose-500/15 text-rose-800 dark:text-rose-300 border border-rose-500/30 ${className}`}
        >
          <AlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
          <span>Overdue</span>
        </span>
      );

    case "due_now":
    case "due":
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold uppercase tracking-wider bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 ${className}`}
        >
          <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
          <span>Due Now</span>
        </span>
      );

    case "scheduled":
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold uppercase tracking-wider bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20 ${className}`}
        >
          <Calendar className="w-3 h-3 text-blue-600 dark:text-blue-400" />
          <span>Scheduled</span>
        </span>
      );

    case "not_scheduled":
    default:
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold uppercase tracking-wider bg-muted text-muted-foreground border border-border ${className}`}
        >
          <CheckCircle2 className="w-3 h-3 text-muted-foreground" />
          <span>Not Scheduled</span>
        </span>
      );
  }
}
