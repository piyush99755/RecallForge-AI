import React from "react";
import {
  Clock,
  Loader2,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  FileCode,
} from "lucide-react";

interface DocumentStatusBadgeProps {
  status: string | null | undefined;
  className?: string;
}

export function DocumentStatusBadge({
  status,
  className = "",
}: DocumentStatusBadgeProps) {
  const normalizedStatus = (status || "pending").toLowerCase();

  switch (normalizedStatus) {
    case "pending":
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border/80 ${className}`}
        >
          <Clock className="w-3 h-3" />
          <span>Pending</span>
        </span>
      );

    case "processing":
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 ${className}`}
        >
          <Loader2 className="w-3 h-3 animate-spin text-amber-600 dark:text-amber-400" />
          <span>Processing</span>
        </span>
      );

    case "ready_for_embedding":
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/20 ${className}`}
        >
          <FileCode className="w-3 h-3 text-amber-600 dark:text-amber-400" />
          <span>Preparing Embeddings</span>
        </span>
      );

    case "embedding":
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 ${className}`}
        >
          <Sparkles className="w-3 h-3 animate-pulse text-indigo-600 dark:text-indigo-400" />
          <span>Embedding</span>
        </span>
      );

    case "ready":
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 ${className}`}
        >
          <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
          <span>Ready</span>
        </span>
      );

    case "failed":
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20 ${className}`}
        >
          <AlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
          <span>Processing Failed</span>
        </span>
      );

    case "embedding_failed":
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20 ${className}`}
        >
          <AlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
          <span>Embedding Failed</span>
        </span>
      );

    default:
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border/80 ${className}`}
        >
          <Clock className="w-3 h-3" />
          <span className="capitalize">{status}</span>
        </span>
      );
  }
}
