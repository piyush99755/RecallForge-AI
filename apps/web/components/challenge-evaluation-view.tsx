import React from "react";
import { ChallengeEvaluationResponse } from "@/lib/types";
import { MasteryBadge } from "@/components/mastery-badge";
import { formatConceptName } from "@/lib/formatters";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lightbulb,
  Award,
  ArrowRight,
  RotateCcw,
  BookOpen,
} from "lucide-react";

interface ChallengeEvaluationViewProps {
  evaluation: ChallengeEvaluationResponse;
  userAnswer: string;
  onNext?: () => void;
  nextButtonLabel?: string;
  onRetry?: () => void;
}

export function ChallengeEvaluationView({
  evaluation,
  userAnswer,
  onNext,
  nextButtonLabel = "Next Review Concept",
  onRetry,
}: ChallengeEvaluationViewProps) {
  const scorePercent = Math.round(evaluation.score * 100);
  const avgScorePercent = Math.round(evaluation.average_score * 100);
  const isPassing = evaluation.correct || evaluation.score >= 0.7;

  return (
    <div className="space-y-6">
      {/* Hero Score Card */}
      <div
        className={`p-6 sm:p-8 rounded-2xl border shadow-cockpit space-y-6 ${
          isPassing
            ? "bg-emerald-500/10 border-emerald-500/20"
            : "bg-rose-500/10 border-rose-500/20"
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                isPassing
                  ? "bg-emerald-500 text-white"
                  : "bg-rose-500 text-white"
              }`}
            >
              {isPassing ? (
                <CheckCircle2 className="w-6 h-6" />
              ) : (
                <XCircle className="w-6 h-6" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span
                  className={`text-xs font-bold uppercase tracking-wider ${
                    isPassing
                      ? "text-emerald-900 dark:text-emerald-200"
                      : "text-rose-900 dark:text-rose-200"
                  }`}
                >
                  {isPassing ? "Concept Verified" : "Needs Reinforcement"}
                </span>
                <span className="text-xs text-muted-foreground">•</span>
                <span className="text-xs font-medium text-muted-foreground">
                  {formatConceptName(evaluation.topic)}
                </span>
              </div>

              <h3 className="text-xl sm:text-2xl font-extrabold text-foreground">
                {isPassing ? "Great Work!" : "Keep Practicing"}
              </h3>
            </div>
          </div>

          {/* Big Score Display */}
          <div className="flex items-center gap-4 self-start sm:self-auto">
            <div className="text-right">
              <span className="block text-xs uppercase font-bold text-muted-foreground">
                Evaluation Score
              </span>
              <span
                className={`text-3xl sm:text-4xl font-extrabold tracking-tight ${
                  isPassing
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-rose-700 dark:text-rose-400"
                }`}
              >
                {scorePercent}%
              </span>
            </div>
          </div>
        </div>

        {/* Feedback Text */}
        <div className="p-4 rounded-xl bg-card/80 border border-border/80 text-foreground text-sm leading-relaxed">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
            Rubric Assessment
          </h4>
          <p>{evaluation.feedback}</p>
        </div>

        {/* Updated Mastery Trajectory bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
          <div className="p-3 rounded-xl bg-card border border-border/70 flex items-center justify-between">
            <span className="text-muted-foreground font-medium">Topic Mastery:</span>
            <MasteryBadge level={evaluation.mastery_level} />
          </div>

          <div className="p-3 rounded-xl bg-card border border-border/70 flex items-center justify-between">
            <span className="text-muted-foreground font-medium">Average Score:</span>
            <span className="font-bold text-foreground">{avgScorePercent}%</span>
          </div>

          <div className="p-3 rounded-xl bg-card border border-border/70 flex items-center justify-between">
            <span className="text-muted-foreground font-medium">Attempt Count:</span>
            <span className="font-bold text-foreground">
              {evaluation.attempts} {evaluation.attempts === 1 ? "attempt" : "attempts"}
            </span>
          </div>
        </div>
      </div>

      {/* Missing Points Alert (if any) */}
      {evaluation.missing_points && evaluation.missing_points.length > 0 && (
        <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-3 shadow-cockpit">
          <div className="flex items-center gap-2 font-bold text-sm text-amber-900 dark:text-amber-300">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>Missing Points & Knowledge Gaps ({evaluation.missing_points.length})</span>
          </div>

          <ul className="space-y-2 text-xs">
            {evaluation.missing_points.map((pt, idx) => (
              <li key={idx} className="flex items-start gap-2 leading-relaxed text-foreground/90 dark:text-foreground">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-600 dark:bg-amber-400 shrink-0 mt-1.5" />
                <span>{pt}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Your Answer vs Expected Answer Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Your Answer */}
        <div className="p-5 rounded-2xl bg-card border border-border shadow-cockpit space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <Award className="w-3.5 h-3.5 text-primary" />
            <span>Your Submission</span>
          </div>
          <p className="text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap">
            {userAnswer}
          </p>
        </div>

        {/* Expected Answer */}
        <div className="p-5 rounded-2xl bg-card border border-border shadow-cockpit space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            <Lightbulb className="w-3.5 h-3.5" />
            <span>Expected Answer</span>
          </div>
          <p className="text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap">
            {evaluation.expected_answer}
          </p>
        </div>
      </div>

      {/* Explanation (if provided) */}
      {evaluation.explanation && (
        <div className="p-5 rounded-2xl bg-card border border-border shadow-cockpit space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
            <BookOpen className="w-3.5 h-3.5" />
            <span>Technical Explanation</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
            {evaluation.explanation}
          </p>
        </div>
      )}

      {/* Next Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-card text-foreground font-semibold text-xs hover:bg-muted transition-all cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Try Again</span>
          </button>
        ) : (
          <div />
        )}

        {onNext && (
          <button
            type="button"
            onClick={onNext}
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary-hover shadow-sm transition-all cursor-pointer"
          >
            <span>{nextButtonLabel}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
