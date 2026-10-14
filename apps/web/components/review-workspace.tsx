"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  getReviewQueue,
  getNextReviewChallenge,
  evaluateChallenge,
} from "@/lib/api";
import {
  ReviewQueueItem,
  ChallengeResponse,
  ChallengeEvaluationResponse,
} from "@/lib/types";
import { formatConceptName } from "@/lib/formatters";
import { MasteryBadge } from "@/components/mastery-badge";
import { ReviewStatusBadge } from "@/components/review-status-badge";
import { ChallengeCard } from "@/components/challenge-card";
import { ChallengeEvaluationView } from "@/components/challenge-evaluation-view";
import {
  RotateCw,
  Sparkles,
  ArrowRight,
  AlertTriangle,
  Clock,
  Target,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronLeft,
  Trophy,
} from "lucide-react";

export function ReviewWorkspace() {
  const [queueItems, setQueueItems] = useState<ReviewQueueItem[]>([]);
  const [isLoadingQueue, setIsLoadingQueue] = useState(true);
  const [queueError, setQueueError] = useState<string | null>(null);

  // Challenge review interaction state
  const [activeChallenge, setActiveChallenge] =
    useState<ChallengeResponse | null>(null);
  const [isGeneratingChallenge, setIsGeneratingChallenge] = useState(false);
  const [challengeError, setChallengeError] = useState<string | null>(null);

  // Evaluation state
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [lastUserAnswer, setLastUserAnswer] = useState("");
  const [evaluation, setEvaluation] =
    useState<ChallengeEvaluationResponse | null>(null);

  // 1. Load review queue
  const loadQueue = useCallback(async () => {
    setIsLoadingQueue(true);
    setQueueError(null);
    try {
      const data = await getReviewQueue();
      setQueueItems(data.items);
    } catch (err) {
      console.error("Failed to load review queue:", err);
      const msg =
        err instanceof Error
          ? err.message
          : "Could not retrieve review queue from FastAPI backend.";
      setQueueError(msg);
    } finally {
      setIsLoadingQueue(false);
    }
  }, []);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  // 2. Start review handler (triggers POST /learning/review-next)
  const handleStartReview = async () => {
    setIsGeneratingChallenge(true);
    setChallengeError(null);
    setEvaluation(null);

    try {
      const challenge = await getNextReviewChallenge();
      setActiveChallenge(challenge);
    } catch (err) {
      console.error("Failed to generate next review challenge:", err);
      const msg =
        err instanceof Error
          ? err.message
          : "Could not generate review challenge from FastAPI backend.";
      setChallengeError(msg);
    } finally {
      setIsGeneratingChallenge(false);
    }
  };

  // 3. Submit evaluation handler
  const handleAnswerSubmit = async (userAnswer: string) => {
    if (!activeChallenge || !activeChallenge.challenge_id || isEvaluating) return;

    setIsEvaluating(true);
    setLastUserAnswer(userAnswer);

    try {
      const evalResult = await evaluateChallenge({
        challenge_id: activeChallenge.challenge_id,
        user_answer: userAnswer,
      });
      setEvaluation(evalResult);
    } catch (err) {
      console.error("Failed to evaluate challenge answer:", err);
      const msg =
        err instanceof Error
          ? err.message
          : "Challenge evaluation failed on backend.";
      setChallengeError(msg);
    } finally {
      setIsEvaluating(false);
    }
  };

  // 4. Return to queue
  const handleReturnToQueue = () => {
    setActiveChallenge(null);
    setEvaluation(null);
    setChallengeError(null);
    loadQueue();
  };

  // If in Challenge or Evaluation view:
  if (activeChallenge) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Navigation Breadcrumb / Header */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={handleReturnToQueue}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Return to Review Queue</span>
          </button>

          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
            Active Spaced Review Session
          </span>
        </div>

        {/* Challenge Error Banner */}
        {challengeError && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-900 dark:text-rose-300 text-xs flex items-center gap-3 shadow-cockpit">
            <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
            <div>
              <h4 className="font-bold">Evaluation Error</h4>
              <p className="mt-0.5 text-rose-800 dark:text-rose-300">{challengeError}</p>
            </div>
          </div>
        )}

        {/* Either Show Evaluation Result or Challenge Card */}
        {evaluation ? (
          <ChallengeEvaluationView
            evaluation={evaluation}
            userAnswer={lastUserAnswer}
            onNext={handleStartReview}
            nextButtonLabel="Next Review Concept"
            onRetry={() => setEvaluation(null)}
          />
        ) : (
          <ChallengeCard
            challenge={activeChallenge}
            isSubmitting={isEvaluating}
            onSubmit={handleAnswerSubmit}
            titlePrefix="Targeted Review Challenge"
          />
        )}
      </div>
    );
  }

  // Loading Review Queue
  if (isLoadingQueue) {
    return (
      <div className="p-12 rounded-2xl bg-card border border-border text-center shadow-cockpit space-y-3 max-w-3xl mx-auto">
        <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
        <h4 className="text-sm font-bold text-foreground">
          Fetching Spaced Repetition Queue...
        </h4>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          Calculating concept decay schedule and prioritizing active knowledge gaps.
        </p>
      </div>
    );
  }

  // Queue Loading Error
  if (queueError) {
    return (
      <div className="p-8 rounded-2xl bg-card border border-border text-center shadow-cockpit space-y-4 max-w-3xl mx-auto">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div>
          <h4 className="text-base font-bold text-foreground mb-1">
            Review data is temporarily unavailable
          </h4>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            {queueError}
          </p>
        </div>
        <button
          type="button"
          onClick={loadQueue}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary-hover transition-colors cursor-pointer"
        >
          <RotateCw className="w-3.5 h-3.5" />
          <span>Retry Connection</span>
        </button>
      </div>
    );
  }

  // Queue is Empty
  if (queueItems.length === 0) {
    return (
      <div className="p-10 rounded-2xl bg-card border border-border text-center shadow-cockpit space-y-4 max-w-3xl mx-auto">
        <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-2">
          <CheckCircle2 className="w-7 h-7" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-foreground mb-1.5">
            Nothing is due for review right now!
          </h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
            All caught up on spaced repetition. As you upload study material and attempt technical challenges, concepts will automatically populate your review queue.
          </p>
        </div>

        <div className="pt-2">
          <Link
            href="/challenges"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary-hover shadow-sm transition-all"
          >
            <Trophy className="w-4 h-4" />
            <span>Try a Study Challenge</span>
          </Link>
        </div>
      </div>
    );
  }

  const nextItem = queueItems[0];
  const formattedConcept = formatConceptName(nextItem.concept);
  const formattedTopic = formatConceptName(nextItem.topic);
  const formattedGapName = nextItem.top_gap
    ? formatConceptName(nextItem.top_gap.display_name)
    : null;

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Challenge Generation Error Banner */}
      {challengeError && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-900 dark:text-rose-300 text-xs flex items-center gap-3 shadow-cockpit">
          <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
          <div>
            <h4 className="font-bold">Review Generation Failed</h4>
            <p className="mt-0.5 text-rose-800 dark:text-rose-300">{challengeError}</p>
          </div>
        </div>
      )}

      {/* Hero Recommended Review Card */}
      <div className="relative overflow-hidden rounded-2xl bg-card border border-border p-6 sm:p-8 shadow-cockpit hover:shadow-cockpit-hover transition-all">
        {/* Ambient glow */}
        <div className="absolute -right-12 -top-12 w-64 h-64 bg-gradient-to-br from-primary/10 via-accent/5 to-transparent rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 space-y-6">
          {/* Header Meta */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 font-semibold text-xs">
                <Clock className="w-3.5 h-3.5" />
                Next Concept to Strengthen
              </span>
              <span className="text-xs text-muted-foreground font-medium">
                {formattedTopic}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <ReviewStatusBadge status={nextItem.review_status} />
              <MasteryBadge level={nextItem.mastery_level} />
            </div>
          </div>

          {/* Title & Reason */}
          <div>
            <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground mb-2">
              {formattedConcept}
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
              {nextItem.reason}
            </p>
          </div>

          {/* Top Knowledge Gap Alert (if present) */}
          {nextItem.top_gap && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wider">
                    Target Gap Detected
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-200/80 dark:bg-amber-900/50 text-amber-900 dark:text-amber-200 font-semibold">
                    Seen {nextItem.top_gap.occurrences}{" "}
                    {nextItem.top_gap.occurrences === 1 ? "time" : "times"}
                  </span>
                </div>
                <p className="text-sm font-semibold text-foreground">
                  {formattedGapName}
                </p>
              </div>
            </div>
          )}

          {/* Card Footer Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-border/60">
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5 font-medium">
                <Target className="w-4 h-4 text-primary" /> Priority Score:{" "}
                {(nextItem.priority_score * 100).toFixed(0)}%
              </span>
              <span>•</span>
              <span>{nextItem.attempts} Previous Attempts</span>
              <span>•</span>
              <span>
                Avg Score: {Math.round(nextItem.average_score * 100)}%
              </span>
            </div>

            <button
              type="button"
              onClick={handleStartReview}
              disabled={isGeneratingChallenge}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm shadow-md hover:bg-primary-hover hover:shadow-lg focus:outline-hidden focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer disabled:opacity-70"
            >
              {isGeneratingChallenge ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Generating Challenge...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Start Review</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Upcoming Queue List */}
      {queueItems.length > 1 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              <span>Full Spaced Repetition Queue ({queueItems.length})</span>
            </h4>
          </div>

          <div className="space-y-3">
            {queueItems.slice(1).map((item, index) => {
              const cName = formatConceptName(item.concept);
              const tName = formatConceptName(item.topic);

              return (
                <div
                  key={`${item.concept}-${index}`}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-card border border-border hover:border-primary/40 shadow-xs transition-all gap-3"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h5 className="text-sm font-bold text-foreground truncate">
                        {cName}
                      </h5>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted font-medium text-muted-foreground border border-border/50">
                        {tName}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {item.reason}
                    </p>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40">
                    <ReviewStatusBadge status={item.review_status} />
                    <MasteryBadge level={item.mastery_level} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
