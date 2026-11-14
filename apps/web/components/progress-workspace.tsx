"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  getLearningProgress,
  getKnowledgeGaps,
  getReviewQueue,
} from "@/lib/api";
import {
  LearningProgressResponse,
  KnowledgeGapResponse,
  ReviewQueueResponse,
} from "@/lib/types";
import {
  formatConceptName,
  formatDate,
} from "@/lib/formatters";
import { MasteryBadge } from "@/components/mastery-badge";
import { ReviewStatusBadge } from "@/components/review-status-badge";
import {
  TrendingUp,
  BrainCircuit,
  RotateCw,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  ArrowRight,
  Search,
  Layers,
  Award,
  BookOpen,
  Compass,
  Trophy,
  Target,
} from "lucide-react";

export function ProgressWorkspace() {
  const [progressData, setProgressData] =
    useState<LearningProgressResponse | null>(null);
  const [gapsData, setGapsData] = useState<KnowledgeGapResponse | null>(null);
  const [reviewQueueData, setReviewQueueData] =
    useState<ReviewQueueResponse | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Sorting for Concept Progress Table
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMastery, setSelectedMastery] = useState<string>("all");
  const [selectedTopic, setSelectedTopic] = useState<string>("all");
  const [sortBy, setSortBy] = useState<
    "score_asc" | "score_desc" | "attempts_desc" | "name_asc"
  >("score_asc");

  // Load all progress intelligence data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [prog, gaps, queue] = await Promise.all([
        getLearningProgress(),
        getKnowledgeGaps(),
        getReviewQueue(),
      ]);

      setProgressData(prog);
      setGapsData(gaps);
      setReviewQueueData(queue);
    } catch (err) {
      console.error("Failed to load progress data:", err);
      const msg =
        err instanceof Error
          ? err.message
          : "Could not retrieve progress analytics from backend.";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Derived summaries & metrics
  const summary = progressData?.summary;
  const items = useMemo(() => progressData?.items || [], [progressData]);
  const recommendedNext = useMemo(
    () => progressData?.recommended_next_concepts || [],
    [progressData]
  );
  const gaps = useMemo(() => gapsData?.items || [], [gapsData]);
  const queueItems = useMemo(
    () => reviewQueueData?.items || [],
    [reviewQueueData]
  );

  // Deterministic metrics
  const totalAttempts = useMemo(() => {
    return items.reduce((sum, it) => sum + it.attempts, 0);
  }, [items]);

  const overallAvgScore = useMemo(() => {
    if (items.length === 0) return 0;
    const sum = items.reduce((acc, it) => acc + it.average_score, 0);
    return sum / items.length;
  }, [items]);

  // Review readiness counts from actual queue review_status
  const reviewCounts = useMemo(() => {
    let overdue = 0;
    let dueNow = 0;
    let scheduled = 0;
    let notScheduled = 0;

    for (const q of queueItems) {
      const status = (q.review_status || "").toLowerCase();
      if (status === "overdue") overdue++;
      else if (status === "due_now" || status === "due") dueNow++;
      else if (status === "scheduled") scheduled++;
      else notScheduled++;
    }

    return { overdue, dueNow, scheduled, notScheduled };
  }, [queueItems]);

  // Unique topics for filtering
  const availableTopics = useMemo(() => {
    const set = new Set<string>();
    items.forEach((it) => {
      if (it.topic) set.add(it.topic);
    });
    return Array.from(set).sort();
  }, [items]);

  // Filtered & sorted concept items
  const filteredItems = useMemo(() => {
    return items
      .filter((it) => {
        // Search query filter (concept name or topic)
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchConcept = it.concept.toLowerCase().includes(q);
          const matchTopic = it.topic.toLowerCase().includes(q);
          if (!matchConcept && !matchTopic) return false;
        }

        // Mastery filter
        if (
          selectedMastery !== "all" &&
          it.mastery_level.toLowerCase() !== selectedMastery.toLowerCase()
        ) {
          return false;
        }

        // Topic filter
        if (selectedTopic !== "all" && it.topic !== selectedTopic) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case "score_asc":
            return a.average_score - b.average_score;
          case "score_desc":
            return b.average_score - a.average_score;
          case "attempts_desc":
            return b.attempts - a.attempts;
          case "name_asc":
            return a.concept.localeCompare(b.concept);
          default:
            return 0;
        }
      });
  }, [items, searchQuery, selectedMastery, selectedTopic, sortBy]);

  // Loading State
  if (isLoading) {
    return (
      <div className="p-12 rounded-2xl bg-card border border-border text-center shadow-cockpit space-y-4 max-w-3xl mx-auto my-8">
        <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
        <h4 className="text-sm font-bold text-foreground">
          Fetching Learning Intelligence...
        </h4>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          Aggregating concept mastery trajectories, retention decay schedules,
          and knowledge gap registries.
        </p>
      </div>
    );
  }

  // Error State
  if (error || !progressData) {
    return (
      <div className="p-8 rounded-2xl bg-card border border-border text-center shadow-cockpit space-y-4 max-w-3xl mx-auto my-8">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div>
          <h4 className="text-base font-bold text-foreground mb-1">
            Progress analytics temporarily unavailable
          </h4>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            {error || "Could not retrieve progress analytics from backend."}
          </p>
        </div>
        <button
          type="button"
          onClick={loadData}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary-hover transition-colors cursor-pointer"
        >
          <RotateCw className="w-3.5 h-3.5" />
          <span>Retry Connection</span>
        </button>
      </div>
    );
  }

  // Total Concepts Zero State
  if (!summary || summary.total_concepts === 0) {
    return (
      <div className="p-10 rounded-2xl bg-card border border-border text-center shadow-cockpit space-y-5 max-w-3xl mx-auto my-8">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
          <TrendingUp className="w-7 h-7" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-foreground mb-1.5">
            No study progress yet
          </h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
            Complete a challenge or review session to begin tracking concept
            mastery and identifying knowledge gaps.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 pt-2">
          <Link
            href="/challenges"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary-hover shadow-sm transition-all"
          >
            <Trophy className="w-4 h-4" />
            <span>Try a Study Challenge</span>
          </Link>
          <Link
            href="/review"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-border bg-card text-foreground font-semibold text-xs hover:bg-muted shadow-sm transition-all"
          >
            <Clock className="w-4 h-4 text-primary" />
            <span>Spaced Review Queue</span>
          </Link>
        </div>
      </div>
    );
  }

  // Calculations for Mastery Distribution Bar (percentages)
  const total = summary.total_concepts || 1;
  const weakPct = (summary.weak_count / total) * 100;
  const devPct = (summary.developing_count / total) * 100;
  const strongPct = (summary.strong_count / total) * 100;
  const masteredPct = (summary.mastered_count / total) * 100;

  const topGap = gaps.length > 0 ? gaps[0] : null;

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* 1. Top High-Level Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Tracked Concepts */}
        <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border shadow-cockpit space-y-2">
          <div className="flex items-center justify-between gap-1 text-muted-foreground">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider">
              Tracked Concepts
            </span>
            <BrainCircuit className="w-4 h-4 text-primary shrink-0" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-foreground">
            {summary.total_concepts}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Active concepts in study vault
          </p>
        </div>

        {/* Overall Accuracy */}
        <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border shadow-cockpit space-y-2">
          <div className="flex items-center justify-between gap-1 text-muted-foreground">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider">
              Average Score
            </span>
            <TrendingUp className="w-4 h-4 text-indigo-500 shrink-0" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-foreground">
            {Math.round(overallAvgScore * 100)}%
          </div>
          <p className="text-[11px] text-muted-foreground">
            Across all attempts & challenges
          </p>
        </div>

        {/* Total Attempts */}
        <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border shadow-cockpit space-y-2">
          <div className="flex items-center justify-between gap-1 text-muted-foreground">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider">
              Total Attempts
            </span>
            <BookOpen className="w-4 h-4 text-amber-500 shrink-0" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-foreground">
            {totalAttempts}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Challenge evaluations recorded
          </p>
        </div>

        {/* Mastered Concepts */}
        <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border shadow-cockpit space-y-2">
          <div className="flex items-center justify-between gap-1 text-muted-foreground">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider">
              Mastered Concepts
            </span>
            <Award className="w-4 h-4 text-emerald-500 shrink-0" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-foreground">
            {summary.mastered_count}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {Math.round(masteredPct)}% retention benchmark met
          </p>
        </div>
      </div>

      {/* 2. Mastery Distribution & Visualizer */}
      <div className="p-6 sm:p-7 rounded-2xl bg-card border border-border shadow-cockpit space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-4">
          <div>
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <Compass className="w-4 h-4 text-primary" />
              <span>Mastery Distribution</span>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Backend-calculated comprehension tiers based on attempts and accuracy.
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border self-start sm:self-auto">
            {summary.total_concepts} Total
          </span>
        </div>

        {/* Proportional Progress Bar */}
        <div className="space-y-2">
          <div className="h-3 w-full bg-muted/60 rounded-full overflow-hidden flex shadow-inner">
            {weakPct > 0 && (
              <div
                style={{ width: `${weakPct}%` }}
                className="bg-rose-500 transition-all duration-500"
                title={`Weak: ${summary.weak_count} (${Math.round(weakPct)}%)`}
              />
            )}
            {devPct > 0 && (
              <div
                style={{ width: `${devPct}%` }}
                className="bg-amber-500 transition-all duration-500"
                title={`Developing: ${summary.developing_count} (${Math.round(
                  devPct
                )}%)`}
              />
            )}
            {strongPct > 0 && (
              <div
                style={{ width: `${strongPct}%` }}
                className="bg-indigo-500 transition-all duration-500"
                title={`Strong: ${summary.strong_count} (${Math.round(
                  strongPct
                )}%)`}
              />
            )}
            {masteredPct > 0 && (
              <div
                style={{ width: `${masteredPct}%` }}
                className="bg-emerald-500 transition-all duration-500"
                title={`Mastered: ${summary.mastered_count} (${Math.round(
                  masteredPct
                )}%)`}
              />
            )}
          </div>
        </div>

        {/* Breakdown Tier Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          {/* Weak */}
          <div className="p-3.5 rounded-xl bg-rose-500/5 border border-rose-500/20 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-rose-700 dark:text-rose-400">
                Weak
              </span>
              <span className="w-2 h-2 rounded-full bg-rose-500" />
            </div>
            <div className="text-xl font-extrabold text-foreground">
              {summary.weak_count}
            </div>
            <span className="text-[11px] text-muted-foreground">
              {Math.round(weakPct)}% of concepts
            </span>
          </div>

          {/* Developing */}
          <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-700 dark:text-amber-400">
                Developing
              </span>
              <span className="w-2 h-2 rounded-full bg-amber-500" />
            </div>
            <div className="text-xl font-extrabold text-foreground">
              {summary.developing_count}
            </div>
            <span className="text-[11px] text-muted-foreground">
              {Math.round(devPct)}% of concepts
            </span>
          </div>

          {/* Strong */}
          <div className="p-3.5 rounded-xl bg-indigo-500/5 border border-indigo-500/20 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-indigo-700 dark:text-indigo-400">
                Strong
              </span>
              <span className="w-2 h-2 rounded-full bg-indigo-500" />
            </div>
            <div className="text-xl font-extrabold text-foreground">
              {summary.strong_count}
            </div>
            <span className="text-[11px] text-muted-foreground">
              {Math.round(strongPct)}% of concepts
            </span>
          </div>

          {/* Mastered */}
          <div className="p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-emerald-700 dark:text-emerald-400">
                Mastered
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            </div>
            <div className="text-xl font-extrabold text-foreground">
              {summary.mastered_count}
            </div>
            <span className="text-[11px] text-muted-foreground">
              {Math.round(masteredPct)}% of concepts
            </span>
          </div>
        </div>
      </div>

      {/* 3. Deterministic Learning Insights & Review Readiness */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Learning Insights (strictly deterministic) */}
        <div className="p-6 rounded-2xl bg-card border border-border shadow-cockpit space-y-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <span>Learning Insights</span>
            </h4>
            <span className="text-[11px] text-muted-foreground font-medium">
              Deterministic data
            </span>
          </div>

          <div className="space-y-3 text-xs">
            {summary.weak_count > 0 ? (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-900 dark:text-rose-300 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <span>
                  <strong>{summary.weak_count} concepts</strong> are currently
                  weak and require active reinforcement.
                </span>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-900 dark:text-emerald-300 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <span>Zero weak concepts detected. Great comprehension stability!</span>
              </div>
            )}

            {reviewCounts.overdue > 0 && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-300 flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <span>
                  <strong>{reviewCounts.overdue} reviews</strong> have passed
                  their memory decay threshold and are overdue.
                </span>
              </div>
            )}

            {topGap && (
              <div className="p-3 rounded-xl bg-muted/60 border border-border/60 text-foreground flex items-start gap-2.5">
                <Layers className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span>
                  Most recurring knowledge gap:{" "}
                  <strong>{topGap.display_name}</strong> (seen{" "}
                  {topGap.occurrences}{" "}
                  {topGap.occurrences === 1 ? "time" : "times"}).
                </span>
              </div>
            )}

            <div className="p-3 rounded-xl bg-muted/40 border border-border/60 text-muted-foreground flex items-start gap-2.5">
              <Award className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>{summary.mastered_count} of {summary.total_concepts}</strong>{" "}
                concepts ({Math.round(masteredPct)}%) have attained long-term
                mastery.
              </span>
            </div>
          </div>
        </div>

        {/* Review Readiness Section */}
        <div className="p-6 rounded-2xl bg-card border border-border shadow-cockpit space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                <span>Review Readiness</span>
              </h4>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-semibold">
                {queueItems.length} in Queue
              </span>
            </div>

            <p className="text-xs text-muted-foreground mt-3 mb-4">
              Scheduled according to your individual retention decay curve.
            </p>

            <div className="grid grid-cols-2 gap-3 text-xs mb-4">
              <div className="p-3 rounded-xl bg-muted/40 border border-border/60">
                <span className="block text-[11px] font-semibold text-rose-600 dark:text-rose-400 mb-1">
                  Overdue
                </span>
                <span className="text-lg font-bold text-foreground">
                  {reviewCounts.overdue}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-muted/40 border border-border/60">
                <span className="block text-[11px] font-semibold text-amber-600 dark:text-amber-400 mb-1">
                  Due Now
                </span>
                <span className="text-lg font-bold text-foreground">
                  {reviewCounts.dueNow}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-muted/40 border border-border/60">
                <span className="block text-[11px] font-semibold text-blue-600 dark:text-blue-400 mb-1">
                  Scheduled
                </span>
                <span className="text-lg font-bold text-foreground">
                  {reviewCounts.scheduled}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-muted/40 border border-border/60">
                <span className="block text-[11px] font-semibold text-muted-foreground mb-1">
                  Not Scheduled
                </span>
                <span className="text-lg font-bold text-foreground">
                  {reviewCounts.notScheduled}
                </span>
              </div>
            </div>
          </div>

          <Link
            href="/review"
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary-hover shadow-sm transition-all"
          >
            <span>Review weak concepts</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* 4. Recommended Next Concepts (Section 9) */}
      <div className="p-6 sm:p-7 rounded-2xl bg-card border border-border shadow-cockpit space-y-5">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div>
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />
              <span>Recommended Next</span>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Prioritized by difficulty, decay trajectory, and historical scores.
            </p>
          </div>
          <Link
            href="/review"
            className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
          >
            <span>Start Session</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {recommendedNext.length === 0 ? (
          <div className="p-6 rounded-xl bg-muted/30 border border-border/60 text-center text-xs text-muted-foreground">
            No specific concepts due for reinforcement right now.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {recommendedNext.map((rec, index) => {
              const cName = formatConceptName(rec.concept);
              const tName = formatConceptName(rec.topic);

              return (
                <div
                  key={`${rec.concept}-${index}`}
                  className="p-4 rounded-xl bg-card border border-border hover:border-primary/40 shadow-xs transition-all space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-muted-foreground truncate">
                        {tName}
                      </span>
                      <MasteryBadge level={rec.mastery_level} />
                    </div>

                    <h4 className="text-sm font-bold text-foreground leading-snug line-clamp-1">
                      {cName}
                    </h4>

                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {rec.reason}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      Avg: {Math.round(rec.average_score * 100)}% ({rec.attempts}x)
                    </span>
                    <span className="font-semibold text-primary">
                      Priority: {Math.round(rec.priority_score * 100)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. Knowledge Gaps Section (Section 8) */}
      <div className="p-6 sm:p-7 rounded-2xl bg-card border border-border shadow-cockpit space-y-5">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div>
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span>Knowledge Gaps & Misconceptions</span>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Canonical technical misconceptions identified during challenge evaluations.
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
            {gaps.length} Total Detected
          </span>
        </div>

        {gaps.length === 0 ? (
          <div className="p-8 rounded-xl bg-muted/30 border border-border/60 text-center text-xs text-muted-foreground space-y-1">
            <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
            <p className="font-semibold text-foreground">
              RecallForge has not detected recurring knowledge gaps yet.
            </p>
            <p>
              As you take challenges, misconceptions will be catalogued here for
              targeted review.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {gaps.map((gap, idx) => {
              const cName = formatConceptName(gap.concept);
              const isHigh = gap.occurrences > 1;

              return (
                <div
                  key={`${gap.gap_key}-${idx}`}
                  className={`p-5 rounded-2xl border shadow-cockpit space-y-3 transition-all ${
                    isHigh
                      ? "bg-amber-500/5 border-amber-500/25"
                      : "bg-card border-border"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-muted-foreground">
                      {cName}
                    </span>
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                        isHigh
                          ? "bg-amber-200/80 dark:bg-amber-900/50 text-amber-900 dark:text-amber-200"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      Seen {gap.occurrences}{" "}
                      {gap.occurrences === 1 ? "time" : "times"}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-foreground mb-1 leading-snug">
                      {gap.display_name}
                    </h4>
                    <p className="text-xs text-foreground/80 dark:text-foreground/90 leading-relaxed">
                      {gap.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 6. Concept Progress Table / List (Section 7) */}
      <div className="p-4 sm:p-7 rounded-2xl bg-card border border-border shadow-cockpit space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-4">
          <div>
            <h3
              id="tracked-concepts-registry-heading"
              className="text-base font-bold text-foreground flex items-center gap-2"
            >
              <BookOpen className="w-4 h-4 text-primary" />
              <span>Tracked Concepts Registry</span>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Comprehensive performance history for all study concepts.
            </p>
          </div>
          <span className="text-xs font-medium text-muted-foreground">
            Showing {filteredItems.length} of {items.length} concepts
          </span>
        </div>

        {/* Filter & Search Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search concepts or topics..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-muted/40 border border-border text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>

          {/* Mastery Filter */}
          <select
            value={selectedMastery}
            onChange={(e) => setSelectedMastery(e.target.value)}
            className="px-3 py-2 rounded-xl bg-muted/40 border border-border text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
          >
            <option value="all">All Mastery Levels</option>
            <option value="weak">Weak</option>
            <option value="developing">Developing</option>
            <option value="strong">Strong</option>
            <option value="mastered">Mastered</option>
          </select>

          {/* Topic Filter */}
          <select
            value={selectedTopic}
            onChange={(e) => setSelectedTopic(e.target.value)}
            className="px-3 py-2 rounded-xl bg-muted/40 border border-border text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer truncate"
          >
            <option value="all">All Topics</option>
            {availableTopics.map((top) => (
              <option key={top} value={top}>
                {formatConceptName(top)}
              </option>
            ))}
          </select>

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={(e) =>
              setSortBy(
                e.target.value as
                  | "score_asc"
                  | "score_desc"
                  | "attempts_desc"
                  | "name_asc"
              )
            }
            className="px-3 py-2 rounded-xl bg-muted/40 border border-border text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
          >
            <option value="score_asc">Lowest Score First (Needs Practice)</option>
            <option value="score_desc">Highest Score First</option>
            <option value="attempts_desc">Most Attempts</option>
            <option value="name_asc">Concept Name (A–Z)</option>
          </select>
        </div>

        {/* Table / List */}
        {filteredItems.length === 0 ? (
          <div className="p-8 rounded-xl bg-muted/30 border border-border/60 text-center text-xs text-muted-foreground">
            No concepts match the selected filters.
          </div>
        ) : (
          <div
            tabIndex={0}
            role="region"
            aria-labelledby="tracked-concepts-registry-heading"
            className="rf-table-wrapper"
          >
            <table className="rf-responsive-table text-left text-xs">
              <thead>
                <tr className="border-b border-border/60 text-muted-foreground uppercase text-[10px] tracking-wider font-semibold">
                  <th scope="col" className="py-3 px-4">
                    Concept & Topic
                  </th>
                  <th scope="col" className="py-3 px-3">
                    Mastery
                  </th>
                  <th scope="col" className="py-3 px-3">
                    Score (Avg / Last)
                  </th>
                  <th scope="col" className="py-3 px-3">
                    Attempts
                  </th>
                  <th scope="col" className="py-3 px-3">
                    Accuracy
                  </th>
                  <th scope="col" className="py-3 px-3">
                    Last Practiced
                  </th>
                  <th scope="col" className="py-3 px-4">
                    Review Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filteredItems.map((item, idx) => {
                  const cName = formatConceptName(item.concept);
                  const tName = formatConceptName(item.topic);
                  const avgPct = Math.round(item.average_score * 100);
                  const lastPct = Math.round(item.last_score * 100);

                  return (
                    <tr
                      key={`${item.concept}-${idx}`}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      {/* Concept & Topic */}
                      <th scope="row" className="py-3 px-4 font-normal text-left">
                        <div className="font-bold text-foreground break-words">
                          {cName}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5 break-words">
                          {tName}
                        </div>
                      </th>

                      {/* Mastery */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <MasteryBadge level={item.mastery_level} />
                      </td>

                      {/* Score */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span>
                          <span className="font-bold text-foreground">
                            {avgPct}%
                          </span>
                          <span className="text-muted-foreground ml-1">
                            / {lastPct}%
                          </span>
                        </span>
                      </td>

                      {/* Attempts */}
                      <td className="py-3 px-3 whitespace-nowrap text-foreground">
                        <span>{item.attempts}</span>
                      </td>

                      {/* Accuracy */}
                      <td className="py-3 px-3 whitespace-nowrap text-[11px] text-muted-foreground">
                        <span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                            {item.correct_count} correct
                          </span>
                          {" / "}
                          <span className="text-rose-600 dark:text-rose-400 font-medium">
                            {item.incorrect_count} incorrect
                          </span>
                        </span>
                      </td>

                      {/* Last Practiced */}
                      <td className="py-3 px-3 whitespace-nowrap text-muted-foreground">
                        <span>{formatDate(item.last_practiced_at)}</span>
                      </td>

                      {/* Review Status & Schedule */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1 items-end sm:items-start">
                          <ReviewStatusBadge status={item.review_status} />
                          {item.next_review_at && (
                            <span className="text-[10px] text-muted-foreground">
                              Due: {formatDate(item.next_review_at)}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
