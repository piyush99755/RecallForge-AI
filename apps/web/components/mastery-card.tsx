import React from "react";
import { LearningProgressSummary } from "@/lib/types";
import { Award, CheckCircle2, TrendingUp, AlertCircle } from "lucide-react";

interface MasteryCardProps {
  summary: LearningProgressSummary;
}

export function MasteryCard({ summary }: MasteryCardProps) {
  const { total_concepts, weak_count, developing_count, strong_count, mastered_count } =
    summary;

  const masteredPct = total_concepts ? Math.round((mastered_count / total_concepts) * 100) : 0;
  const strongPct = total_concepts ? Math.round((strong_count / total_concepts) * 100) : 0;
  const developingPct = total_concepts ? Math.round((developing_count / total_concepts) * 100) : 0;
  const weakPct = total_concepts ? Math.round((weak_count / total_concepts) * 100) : 0;

  return (
    <div className="rounded-2xl bg-card border border-border p-6 shadow-cockpit flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <Award className="w-4 h-4 text-primary" />
            <span>Mastery Breakdown</span>
          </h3>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
            {total_concepts} Concepts
          </span>
        </div>

        {/* Stacked Progress Bar */}
        <div className="w-full h-3 bg-muted rounded-full overflow-hidden flex mb-6 p-0.5 border border-border/50">
          <div
            style={{ width: `${masteredPct}%` }}
            className="bg-emerald-500 h-full rounded-l-full transition-all"
            title={`Mastered: ${mastered_count}`}
          />
          <div
            style={{ width: `${strongPct}%` }}
            className="bg-blue-500 h-full transition-all"
            title={`Strong: ${strong_count}`}
          />
          <div
            style={{ width: `${developingPct}%` }}
            className="bg-amber-500 h-full transition-all"
            title={`Developing: ${developing_count}`}
          />
          <div
            style={{ width: `${weakPct}%` }}
            className="bg-rose-500 h-full rounded-r-full transition-all"
            title={`Weak: ${weak_count}`}
          />
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/15 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground font-medium">Mastered</p>
              <p className="text-lg font-bold text-emerald-950 dark:text-emerald-300">
                {mastered_count} <span className="text-xs text-muted-foreground font-normal">({masteredPct}%)</span>
              </p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/15 flex items-center gap-3">
            <TrendingUp className="w-5 h-5 text-blue-600 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground font-medium">Strong</p>
              <p className="text-lg font-bold text-blue-950 dark:text-blue-300">
                {strong_count} <span className="text-xs text-muted-foreground font-normal">({strongPct}%)</span>
              </p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/15 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground font-medium">Developing</p>
              <p className="text-lg font-bold text-amber-950 dark:text-amber-300">
                {developing_count} <span className="text-xs text-muted-foreground font-normal">({developingPct}%)</span>
              </p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/15 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground font-medium">Needs Work</p>
              <p className="text-lg font-bold text-rose-950 dark:text-rose-300">
                {weak_count} <span className="text-xs text-muted-foreground font-normal">({weakPct}%)</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
