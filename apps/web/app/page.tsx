import React from "react";
import { SectionHeading } from "@/components/section-heading";
import { NextReviewCard } from "@/components/next-review-card";
import { MasteryCard } from "@/components/mastery-card";
import { KnowledgeGapCard } from "@/components/knowledge-gap-card";
import { ReviewQueueCard } from "@/components/review-queue-card";
import {
  MOCK_NEXT_REVIEW,
  MOCK_SUMMARY,
  MOCK_KNOWLEDGE_GAPS,
  MOCK_REVIEW_QUEUE,
} from "@/lib/mock-data";
import { Flame, Sparkles } from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      {/* Welcome & Motivational Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-primary to-indigo-900 text-primary-foreground shadow-md">
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
          <p className="text-sm text-indigo-100 mt-1 max-w-xl">
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
          <NextReviewCard item={MOCK_NEXT_REVIEW} />
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
        <ReviewQueueCard items={MOCK_REVIEW_QUEUE} />
      </div>
    </div>
  );
}
