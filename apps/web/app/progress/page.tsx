import React from "react";
import { SectionHeading } from "@/components/section-heading";
import { TrendingUp, BarChart3, AlertOctagon, LineChart } from "lucide-react";

export default function ProgressPage() {
  return (
    <div className="space-y-6">
      <SectionHeading
        title="Learning Progress & Analytics"
        subtitle="Track concept mastery trajectories, retention metrics, and recurring knowledge gaps"
      />

      <div className="rounded-2xl bg-card border border-border p-8 shadow-cockpit text-center max-w-3xl mx-auto my-8">
        <div className="w-14 h-14 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center mx-auto mb-4">
          <TrendingUp className="w-7 h-7" />
        </div>

        <h3 className="text-xl font-bold text-foreground mb-2">
          Mastery Analytics & Gap Tracking
        </h3>

        <p className="text-sm text-muted-foreground leading-relaxed max-w-lg mx-auto mb-6">
          Deep-dive into your comprehension statistics. Monitor mastery levels across topics, view recall decay curves, and analyze recurring misconceptions.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left mt-8 pt-6 border-t border-border/60">
          <div className="p-4 rounded-xl bg-muted/40 border border-border/50">
            <BarChart3 className="w-4 h-4 text-primary mb-2" />
            <h4 className="text-xs font-bold text-foreground">Topic Level Breakdown</h4>
            <p className="text-xs text-muted-foreground mt-1">
              Compare accuracy rates across different technical domains.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-muted/40 border border-border/50">
            <AlertOctagon className="w-4 h-4 text-rose-600 mb-2" />
            <h4 className="text-xs font-bold text-foreground">Gap Occurrences</h4>
            <p className="text-xs text-muted-foreground mt-1">
              Trace persistent gaps causing recurring review failures.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-muted/40 border border-border/50">
            <LineChart className="w-4 h-4 text-emerald-600 mb-2" />
            <h4 className="text-xs font-bold text-foreground">Historical Trajectory</h4>
            <p className="text-xs text-muted-foreground mt-1">
              Measure retention improvements over time.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
