import React from "react";
import { SectionHeading } from "@/components/section-heading";
import { RotateCw, BrainCircuit, Target, ShieldCheck } from "lucide-react";

export default function ReviewPage() {
  return (
    <div className="space-y-6">
      <SectionHeading
        title="Interactive Concept Review"
        subtitle="Adaptive spaced repetition engine designed to strengthen your long-term concept retention"
      />

      <div className="rounded-2xl bg-card border border-border p-8 shadow-cockpit text-center max-w-3xl mx-auto my-8">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto mb-4">
          <RotateCw className="w-7 h-7" />
        </div>

        <h3 className="text-xl font-bold text-foreground mb-2">
          Spaced Repetition & Decay Engine
        </h3>

        <p className="text-sm text-muted-foreground leading-relaxed max-w-lg mx-auto mb-6">
          Review concepts right before memory decay occurs. The algorithm schedules targets based on your history score, difficulty rating, and unresolved knowledge gaps.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left mt-8 pt-6 border-t border-border/60">
          <div className="p-4 rounded-xl bg-muted/40 border border-border/50">
            <BrainCircuit className="w-4 h-4 text-primary mb-2" />
            <h4 className="text-xs font-bold text-foreground">Priority Queue</h4>
            <p className="text-xs text-muted-foreground mt-1">
              Calculates dynamic priority score for active concepts.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-muted/40 border border-border/50">
            <Target className="w-4 h-4 text-rose-600 mb-2" />
            <h4 className="text-xs font-bold text-foreground">Gap Reinforcement</h4>
            <p className="text-xs text-muted-foreground mt-1">
              Injects targeted questions for active misconceptions.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-muted/40 border border-border/50">
            <ShieldCheck className="w-4 h-4 text-emerald-600 mb-2" />
            <h4 className="text-xs font-bold text-foreground">Mastery Tracking</h4>
            <p className="text-xs text-muted-foreground mt-1">
              Tracks transition from Developing to Mastered status.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
