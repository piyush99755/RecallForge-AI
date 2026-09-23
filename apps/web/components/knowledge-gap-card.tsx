import React from "react";
import { KnowledgeGapItem } from "@/lib/types";
import { AlertCircle, HelpCircle, ArrowRight } from "lucide-react";

interface KnowledgeGapCardProps {
  gap: KnowledgeGapItem;
}

export function KnowledgeGapCard({ gap }: KnowledgeGapCardProps) {
  return (
    <div className="rounded-2xl bg-card border border-border p-5 shadow-cockpit hover:shadow-cockpit-hover transition-all flex flex-col justify-between group">
      <div>
        {/* Top badges */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-rose-500/10 text-rose-700 dark:text-rose-400 text-xs font-semibold border border-rose-500/20">
            <AlertCircle className="w-3.5 h-3.5" />
            Needs reinforcement
          </span>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
            {gap.occurrences} {gap.occurrences === 1 ? "occurrence" : "occurrences"}
          </span>
        </div>

        {/* Gap Name */}
        <h4 className="text-base font-bold text-foreground group-hover:text-primary transition-colors mb-1.5 leading-snug">
          {gap.display_name}
        </h4>

        {/* Concept tag */}
        <div className="inline-flex items-center gap-1 text-xs text-muted-foreground font-medium mb-3">
          <HelpCircle className="w-3.5 h-3.5 text-primary" />
          <span>Concept: {gap.concept}</span>
        </div>

        {/* Description / Reinforcement Message */}
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
          {gap.description}
        </p>
      </div>

      {/* Action link */}
      <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-xs font-semibold text-primary group-hover:underline">
        <span>Target this gap</span>
        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
      </div>
    </div>
  );
}
