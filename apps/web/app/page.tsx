"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  getReviewQueue,
  getLearningProgress,
  getKnowledgeGaps,
} from "@/lib/api";
import {
  ReviewQueueResponse,
  LearningProgressResponse,
  KnowledgeGapResponse,
} from "@/lib/types";
import { SectionHeading } from "@/components/section-heading";
import { NextReviewCard } from "@/components/next-review-card";
import { MasteryCard } from "@/components/mastery-card";
import { KnowledgeGapCard } from "@/components/knowledge-gap-card";
import { ReviewQueueCard } from "@/components/review-queue-card";
import {
  BrainCircuit,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Trophy,
  RotateCw,
} from "lucide-react";

export default function DashboardPage() {
  const [reviewQueue, setReviewQueue] = useState<ReviewQueueResponse | null>(
    null
  );
  const [progressData, setProgressData] =
    useState<LearningProgressResponse | null>(null);
  const [gapsData, setGapsData] = useState<KnowledgeGapResponse | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isQueueError, setIsQueueError] = useState(false);
  const [isProgressError, setIsProgressError] = useState(false);
  const [isGapsError, setIsGapsError] = useState(false);

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    const [queueResult, progressResult, gapsResult] = await Promise.allSettled([
      getReviewQueue(),
      getLearningProgress(),
      getKnowledgeGaps(),
    ]);

    if (queueResult.status === "fulfilled") {
      setReviewQueue(queueResult.value);
      setIsQueueError(false);
    } else {
      console.error(
        "Failed to fetch review queue from backend:",
        queueResult.reason
      );
      setIsQueueError(true);
    }

    if (progressResult.status === "fulfilled") {
      setProgressData(progressResult.value);
      setIsProgressError(false);
    } else {
      console.error(
        "Failed to fetch learning progress from backend:",
        progressResult.reason
      );
      setIsProgressError(true);
    }

    if (gapsResult.status === "fulfilled") {
      setGapsData(gapsResult.value);
      setIsGapsError(false);
    } else {
      console.error(
        "Failed to fetch knowledge gaps from backend:",
        gapsResult.reason
      );
      setIsGapsError(true);
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const hasQueueItems = Boolean(reviewQueue && reviewQueue.items.length > 0);
  const nextReviewItem = hasQueueItems ? reviewQueue!.items[0] : null;
  const previewItems = hasQueueItems ? reviewQueue!.items.slice(0, 3) : [];
  const topGaps = gapsData ? gapsData.items.slice(0, 4) : [];

  return (
    <div className="space-y-8">
      {/* Welcome & Motivational Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 sm:p-8 rounded-2xl sm:rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 dark:from-slate-950 dark:via-indigo-950/80 dark:to-slate-950 border border-indigo-500/20 text-white shadow-md">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-white text-xs font-semibold backdrop-blur-xs">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              Daily Study Cockpit
            </span>
            <span className="text-xs text-indigo-200">
              Spaced Repetition Active
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Ready for your next review?
          </h1>
          <p className="text-sm text-indigo-100/90 mt-1 max-w-xl">
            Focus on high-priority concepts and reinforce weak knowledge gaps to
            build long-term retention.
          </p>
        </div>

        {progressData && (
          <div className="flex items-center gap-3 shrink-0 self-start md:self-center">
            <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-white/10 border border-white/15 text-white backdrop-blur-xs">
              <BrainCircuit className="w-5 h-5 text-indigo-300" />
              <div>
                <p className="text-xs text-indigo-200">Tracked Concepts</p>
                <p className="text-sm font-bold">
                  {progressData.summary.total_concepts}{" "}
                  {progressData.summary.total_concepts === 1
                    ? "Concept"
                    : "Concepts"}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Grid: Next Review Hero + Mastery Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {isLoading ? (
            <div className="h-full min-h-[220px] rounded-2xl bg-card border border-border p-8 shadow-cockpit flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <p className="text-xs text-muted-foreground font-medium">
                Loading prioritized review queue...
              </p>
            </div>
          ) : isQueueError ? (
            <div className="h-full rounded-2xl bg-card border border-border p-8 shadow-cockpit flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-3">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-foreground mb-1">
                Review data is temporarily unavailable
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mb-4">
                Could not reach the RecallForge study engine API. Check your
                connection or backend server status.
              </p>
              <button
                type="button"
                onClick={loadDashboard}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary-hover transition-colors cursor-pointer"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
            </div>
          ) : nextReviewItem ? (
            <NextReviewCard item={nextReviewItem} />
          ) : (
            <div className="h-full rounded-2xl bg-card border border-border p-8 shadow-cockpit flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-foreground mb-1">
                All caught up on reviews!
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mb-4">
                No concepts are currently due for spaced repetition. Complete a
                new study challenge to add concepts to your queue.
              </p>
              <Link
                href="/challenges"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary-hover transition-colors shadow-sm"
              >
                <Trophy className="w-3.5 h-3.5" />
                <span>Try a Study Challenge</span>
              </Link>
            </div>
          )}
        </div>

        <div>
          {isLoading ? (
            <div className="h-full min-h-[220px] rounded-2xl bg-card border border-border p-6 shadow-cockpit flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-7 h-7 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <p className="text-xs text-muted-foreground font-medium">
                Loading mastery breakdown...
              </p>
            </div>
          ) : isProgressError || !progressData ? (
            <div className="h-full rounded-2xl bg-card border border-border p-6 shadow-cockpit flex flex-col items-center justify-center text-center">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-2.5">
                <AlertCircle className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-foreground mb-1">
                Mastery summary unavailable
              </h3>
              <p className="text-xs text-muted-foreground">
                Could not load concept mastery breakdown from backend.
              </p>
            </div>
          ) : (
            <MasteryCard summary={progressData.summary} />
          )}
        </div>
      </div>

      {/* Active Knowledge Gaps Section */}
      <div>
        <SectionHeading
          title="Active Knowledge Gaps"
          subtitle="Key concepts requiring targeted reinforcement based on recent challenge attempts"
        />
        {isLoading ? (
          <div className="rounded-2xl bg-card border border-border p-8 shadow-cockpit text-center">
            <p className="text-xs text-muted-foreground font-medium">
              Loading active knowledge gaps...
            </p>
          </div>
        ) : isGapsError ? (
          <div className="rounded-2xl bg-card border border-border p-6 shadow-cockpit text-center">
            <p className="text-sm font-semibold text-muted-foreground">
              Knowledge gap data is temporarily unavailable.
            </p>
          </div>
        ) : topGaps.length === 0 ? (
          <div className="rounded-2xl bg-card border border-border p-8 shadow-cockpit text-center">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-foreground mb-1">
              No recurring knowledge gaps detected yet.
            </h4>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              As you complete study challenges and reviews, any recurring
              misconceptions will be surfaced here for targeted reinforcement.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {topGaps.map((gap, index) => (
              <KnowledgeGapCard
                key={`${gap.concept}-${gap.gap_key}-${index}`}
                gap={gap}
              />
            ))}
          </div>
        )}
      </div>

      {/* Spaced Repetition Queue Preview */}
      <div>
        <SectionHeading
          title="Spaced Repetition Queue"
          subtitle="Concepts sorted by decay schedule and review urgency"
        />
        {isLoading ? (
          <div className="rounded-2xl bg-card border border-border p-6 shadow-cockpit text-center">
            <p className="text-xs text-muted-foreground font-medium">
              Loading queue preview...
            </p>
          </div>
        ) : isQueueError ? (
          <div className="rounded-2xl bg-card border border-border p-6 shadow-cockpit text-center">
            <p className="text-sm font-semibold text-muted-foreground">
              Review data is temporarily unavailable.
            </p>
          </div>
        ) : (
          <ReviewQueueCard items={previewItems} />
        )}
      </div>
    </div>
  );
}
