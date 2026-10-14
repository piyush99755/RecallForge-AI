"use client";

import React, { useState } from "react";
import { ChallengeResponse } from "@/lib/types";
import { formatConceptName } from "@/lib/formatters";
import { SourceCitations } from "@/components/source-citations";
import { Sparkles, Loader2, HelpCircle, Layers, Send } from "lucide-react";

interface ChallengeCardProps {
  challenge: ChallengeResponse;
  isSubmitting: boolean;
  onSubmit: (answer: string) => void;
  titlePrefix?: string;
}

export function ChallengeCard({
  challenge,
  isSubmitting,
  onSubmit,
  titlePrefix = "Study Challenge",
}: ChallengeCardProps) {
  const [answer, setAnswer] = useState("");

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!answer.trim() || isSubmitting) return;
    onSubmit(answer.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  const formattedTopic = formatConceptName(challenge.topic);
  const formattedConcept = challenge.concept
    ? formatConceptName(challenge.concept)
    : null;

  return (
    <div className="space-y-6">
      {/* Question Card */}
      <div className="p-6 sm:p-8 rounded-2xl bg-card border border-border shadow-cockpit space-y-6">
        {/* Meta badges */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary font-semibold text-xs border border-primary/20">
              <Sparkles className="w-3.5 h-3.5" />
              {titlePrefix}
            </span>

            <span className="text-xs font-semibold text-foreground">
              {formattedTopic}
            </span>
          </div>

          {formattedConcept && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-muted text-muted-foreground text-xs font-medium border border-border">
              <Layers className="w-3 h-3 text-primary" />
              <span>Target: {formattedConcept}</span>
            </div>
          )}
        </div>

        {/* Question Text */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <HelpCircle className="w-4 h-4 text-primary" />
            <span>Diagnostic Scenario</span>
          </div>

          <h3 className="text-lg sm:text-xl font-bold text-foreground leading-relaxed whitespace-pre-wrap">
            {challenge.question}
          </h3>
        </div>

        {/* Sources Grid (if available) */}
        {challenge.sources && challenge.sources.length > 0 && (
          <div className="pt-2">
            <SourceCitations
              sources={challenge.sources}
              title="Grounded Sources for this Challenge"
            />
          </div>
        )}

        {/* Answer Form */}
        <form onSubmit={handleSubmit} className="space-y-4 pt-4 border-t border-border/60">
          <div>
            <label
              htmlFor="challenge-answer-input"
              className="block text-xs font-bold uppercase tracking-wider text-foreground mb-2"
            >
              Your Solution / Explanation
            </label>
            <textarea
              id="challenge-answer-input"
              rows={5}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isSubmitting}
              placeholder="Provide your complete technical answer, trade-offs, or code explanation..."
              className="w-full px-4 py-3 rounded-xl bg-muted/30 border border-border/80 text-sm text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-y disabled:opacity-60"
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>
              Press{" "}
              <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-[10px] font-mono">
                Ctrl
              </kbd>{" "}
              +{" "}
              <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-[10px] font-mono">
                Enter
              </kbd>{" "}
              to submit
            </span>

            <button
              type="submit"
              disabled={!answer.trim() || isSubmitting}
              className={`inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-xs transition-all shadow-sm ${
                answer.trim() && !isSubmitting
                  ? "bg-primary text-primary-foreground hover:bg-primary-hover cursor-pointer"
                  : "bg-muted text-muted-foreground border border-border/60 cursor-not-allowed opacity-70"
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Evaluating Answer...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Submit Answer</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
