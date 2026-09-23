import React from "react";
import { ReviewQueueItem } from "@/lib/types";
import { ArrowRight, AlertTriangle, Sparkles, Clock, Target } from "lucide-react";

interface NextReviewCardProps {
  item: ReviewQueueItem;
}

export function NextReviewCard({ item }: NextReviewCardProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-card border border-border p-6 sm:p-8 shadow-cockpit hover:shadow-cockpit-hover transition-all group">
      {/* Decorative gradient background glow */}
      <div className="absolute -right-12 -top-12 w-64 h-64 bg-gradient-to-br from-primary/10 via-indigo-500/5 to-transparent rounded-full blur-2xl pointer-events-none" />

      <div className="relative z-10 flex flex-col justify-between h-full gap-6">
        <div>
          {/* Top header meta */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-700 font-semibold text-xs">
                <Clock className="w-3.5 h-3.5" />
                What to strengthen next
              </span>
              <span className="text-xs text-muted-foreground font-medium">
                {item.topic}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
                {item.review_status}
              </span>
              <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold uppercase tracking-wider bg-muted text-muted-foreground border border-border">
                {item.mastery_level}
              </span>
            </div>
          </div>

          {/* Concept Title */}
          <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground group-hover:text-primary transition-colors mb-2">
            {item.concept}
          </h3>

          <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl mb-5">
            {item.reason}
          </p>

          {/* Top Knowledge Gap Alert Callout */}
          {item.top_gap && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                    Target Gap Detected
                  </span>
                  <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-amber-200 text-amber-900 font-semibold">
                    {item.top_gap.occurrences} attempts affected
                  </span>
                </div>
                <p className="text-sm font-semibold text-foreground">
                  {item.top_gap.display_name}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-border/60">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5 font-medium">
              <Target className="w-4 h-4 text-primary" /> Priority Score: {(item.priority_score * 100).toFixed(0)}%
            </span>
            <span>•</span>
            <span>{item.attempts} Previous Attempts</span>
          </div>

          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm shadow-md hover:bg-primary-hover hover:shadow-lg focus:outline-hidden focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>Start Review</span>
            <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
}
