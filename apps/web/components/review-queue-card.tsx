import React from "react";
import { ReviewQueueItem } from "@/lib/types";
import { formatConceptName, formatMasteryLevel } from "@/lib/formatters";
import { Clock, RotateCcw, ChevronRight, CheckCircle2 } from "lucide-react";

interface ReviewQueueCardProps {
  items: ReviewQueueItem[];
}

export function ReviewQueueCard({ items }: ReviewQueueCardProps) {
  if (!items || items.length === 0) {
    return (
      <div className="rounded-2xl bg-card border border-border p-8 shadow-cockpit text-center">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto mb-3">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <h4 className="text-base font-bold text-foreground mb-1">
          Review Queue Clear
        </h4>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          No review items yet. Complete a challenge to start building your learning queue.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-card border border-border p-6 shadow-cockpit">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            <span>Upcoming Review Queue</span>
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Concepts queued by spaced repetition priority
          </p>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary">
          {items.length} {items.length === 1 ? "Item" : "Items"}
        </span>
      </div>

      <div className="space-y-3">
        {items.map((item, index) => {
          const isDue = item.review_status === "due";
          const formattedConcept = formatConceptName(item.concept);
          const formattedTopic = formatConceptName(item.topic);

          return (
            <div
              key={`${item.concept}-${index}`}
              className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-muted/40 border border-border/60 hover:bg-muted/70 transition-all gap-3 group"
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                    isDue
                      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                      : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                  }`}
                >
                  <RotateCcw className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                      {formattedConcept}
                    </h4>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted font-medium text-muted-foreground border border-border/50">
                      {formattedTopic}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                    {item.reason}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded-md text-[11px] font-semibold uppercase tracking-wider ${
                      isDue
                        ? "bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                        : "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                    }`}
                  >
                    {item.review_status}
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-muted text-muted-foreground border border-border">
                    {formatMasteryLevel(item.mastery_level)}
                  </span>
                </div>

                <button
                  type="button"
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
                  aria-label={`Review ${formattedConcept}`}
                >
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
