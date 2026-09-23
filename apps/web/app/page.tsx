import React from "react";
import { getReviewQueue } from "@/lib/api";

export const dynamic = "force-dynamic";
import { ReviewQueueResponse } from "@/lib/types";
import { SectionHeading } from "@/components/section-heading";
import { NextReviewCard } from "@/components/next-review-card";
import { MasteryCard } from "@/components/mastery-card";
import { KnowledgeGapCard } from "@/components/knowledge-gap-card";
import { ReviewQueueCard } from "@/components/review-queue-card";
import { MOCK_SUMMARY, MOCK_KNOWLEDGE_GAPS } from "@/lib/mock-data";
import { Flame, Sparkles, CheckCircle2, AlertCircle } from "lucide-react";

export default async function DashboardPage() {
  let reviewQueue: ReviewQueueResponse | null = null;
  let isApiError = false;

  try {
    reviewQueue = await getReviewQueue();
  } catch (error) {
    console.error("Failed to fetch review queue from FastAPI backend:", error);
    isApiError = true;
  }

  const hasItems = Boolean(reviewQueue && reviewQueue.items.length > 0);
  const nextReviewItem = hasItems ? reviewQueue!.items[0] : null;
  const previewItems = hasItems ? reviewQueue!.items.slice(0, 3) : [];

  return (
    <div className="space-y-8">
      {/* Welcome & Motivational Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 dark:from-slate-950 dark:via-indigo-950/80 dark:to-slate-950 border border-indigo-500/20 text-white shadow-md">
        <div>
          <div className="flex items-center gap-2 mb-2">
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
            Focus on high-priority concepts and reinforce weak knowledge gaps to build long-term retention.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0 self-start md:self-center">
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/10 border border-white/15 text-white backdrop-blur-xs">
            <Flame className="w-5 h-5 text-amber-400" />
            <div>
              <p className="text-xs text-indigo-200">Streak Momentum</p>
              <p className="text-sm font-bold">5 Days Active</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Next Review Hero + Mastery Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {isApiError ? (
            <div className="h-full rounded-2xl bg-card border border-border p-8 shadow-cockpit flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-3">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-foreground mb-1">
                Review data is temporarily unavailable
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm">
                Could not reach the FastAPI study engine backend. Verify that local server is running at http://127.0.0.1:8001.
              </p>
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
              <p className="text-xs text-muted-foreground max-w-sm">
                No concepts are currently due for spaced repetition. Complete a new study challenge to add concepts to your queue.
              </p>
            </div>
          )}
        </div>

        <div>
          <MasteryCard summary={MOCK_SUMMARY} />
        </div>
      </div>

      {/* Active Knowledge Gaps Section */}
      <div>
        <SectionHeading
          title="Active Knowledge Gaps"
          subtitle="Key concepts requiring targeted reinforcement based on recent challenge attempts"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {MOCK_KNOWLEDGE_GAPS.map((gap) => (
            <KnowledgeGapCard key={gap.gap_key} gap={gap} />
          ))}
        </div>
      </div>

      {/* Spaced Repetition Queue Preview */}
      <div>
        <SectionHeading
          title="Spaced Repetition Queue"
          subtitle="Concepts sorted by decay schedule and review urgency"
        />
        {isApiError ? (
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
