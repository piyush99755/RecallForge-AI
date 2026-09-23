import React from "react";
import { SectionHeading } from "@/components/section-heading";
import { Trophy, Code2, Zap, CheckCircle2 } from "lucide-react";

export default function ChallengesPage() {
  return (
    <div className="space-y-6">
      <SectionHeading
        title="Study Challenges & Quizzes"
        subtitle="AI-generated technical scenarios, diagnostic questions, and code review challenges"
      />

      <div className="rounded-2xl bg-card border border-border p-8 shadow-cockpit text-center max-w-3xl mx-auto my-8">
        <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center mx-auto mb-4">
          <Trophy className="w-7 h-7" />
        </div>

        <h3 className="text-xl font-bold text-foreground mb-2">
          Diagnostic Technical Scenarios
        </h3>

        <p className="text-sm text-muted-foreground leading-relaxed max-w-lg mx-auto mb-6">
          Test your comprehension against dynamically synthesized questions derived directly from your notes, architecture docs, and codebase examples.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left mt-8 pt-6 border-t border-border/60">
          <div className="p-4 rounded-xl bg-muted/40 border border-border/50">
            <Code2 className="w-4 h-4 text-primary mb-2" />
            <h4 className="text-xs font-bold text-foreground">Code-Aware Quiz</h4>
            <p className="text-xs text-muted-foreground mt-1">
              Real code snippets with subtle bug detection or output predictions.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-muted/40 border border-border/50">
            <Zap className="w-4 h-4 text-amber-600 mb-2" />
            <h4 className="text-xs font-bold text-foreground">Gap Diagnostics</h4>
            <p className="text-xs text-muted-foreground mt-1">
              Automatically logs incorrect options into your Knowledge Gap registry.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-muted/40 border border-border/50">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 mb-2" />
            <h4 className="text-xs font-bold text-foreground">Detailed Rubric</h4>
            <p className="text-xs text-muted-foreground mt-1">
              Step-by-step explanations referencing source material.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
