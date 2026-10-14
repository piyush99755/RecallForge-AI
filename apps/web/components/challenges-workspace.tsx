"use client";

import React, { useState } from "react";
import { generateChallenge, evaluateChallenge } from "@/lib/api";
import { ChallengeResponse, ChallengeEvaluationResponse } from "@/lib/types";
import { ChallengeCard } from "@/components/challenge-card";
import { ChallengeEvaluationView } from "@/components/challenge-evaluation-view";
import {
  Trophy,
  Sparkles,
  Loader2,
  AlertCircle,
  HelpCircle,
  RotateCcw,
  Zap,
} from "lucide-react";

const SUGGESTED_TOPICS = [
  "Python Memory Model & Hash Tables",
  "Vector Search HNSW vs IVF Trade-offs",
  "RAG Context Chunking Strategies",
  "Database Indexing & B-Trees",
  "Distributed Consensus Algorithms",
];

export function ChallengesWorkspace() {
  const [topic, setTopic] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Active challenge state
  const [activeChallenge, setActiveChallenge] =
    useState<ChallengeResponse | null>(null);
  const [insufficientEvidenceMsg, setInsufficientEvidenceMsg] = useState<
    string | null
  >(null);

  // Evaluation state
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [lastUserAnswer, setLastUserAnswer] = useState("");
  const [evaluation, setEvaluation] =
    useState<ChallengeEvaluationResponse | null>(null);

  // 1. Generate challenge handler
  const handleGenerate = async (selectedTopic?: string) => {
    const targetTopic = (selectedTopic || topic).trim();
    if (!targetTopic || isGenerating) return;

    if (selectedTopic) {
      setTopic(selectedTopic);
    }

    setIsGenerating(true);
    setGenerateError(null);
    setInsufficientEvidenceMsg(null);
    setActiveChallenge(null);
    setEvaluation(null);

    try {
      const challenge = await generateChallenge({
        topic: targetTopic,
      });

      // Check if insufficient confidence / evidence returned
      if (
        !challenge.challenge_id ||
        challenge.question.includes("couldn't find enough relevant") ||
        challenge.sources.length === 0
      ) {
        setInsufficientEvidenceMsg(
          challenge.question ||
            "RecallForge could not find enough supporting material in your Study Library for this topic."
        );
      } else {
        setActiveChallenge(challenge);
      }
    } catch (err) {
      console.error("Failed to generate challenge:", err);
      const msg =
        err instanceof Error
          ? err.message
          : "Could not generate challenge from FastAPI backend.";
      setGenerateError(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  // 2. Submit evaluation handler
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
      setGenerateError(msg);
    } finally {
      setIsEvaluating(false);
    }
  };

  // 3. Reset / Create new challenge
  const handleReset = () => {
    setActiveChallenge(null);
    setEvaluation(null);
    setGenerateError(null);
    setInsufficientEvidenceMsg(null);
  };

  // If in active Challenge or Evaluation view:
  if (activeChallenge) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Generate Different Challenge</span>
          </button>

          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
            Self-Directed Challenge
          </span>
        </div>

        {generateError && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-900 dark:text-rose-300 text-xs flex items-center gap-3 shadow-cockpit">
            <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
            <div>
              <h4 className="font-bold">Evaluation Error</h4>
              <p className="mt-0.5 text-rose-800 dark:text-rose-300">{generateError}</p>
            </div>
          </div>
        )}

        {evaluation ? (
          <ChallengeEvaluationView
            evaluation={evaluation}
            userAnswer={lastUserAnswer}
            onNext={handleReset}
            nextButtonLabel="Try Another Challenge"
            onRetry={() => setEvaluation(null)}
          />
        ) : (
          <ChallengeCard
            challenge={activeChallenge}
            isSubmitting={isEvaluating}
            onSubmit={handleAnswerSubmit}
            titlePrefix="Diagnostic Technical Challenge"
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Generate Input Card */}
      <div className="rounded-2xl bg-card border border-border p-6 sm:p-8 shadow-cockpit space-y-6">
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Trophy className="w-5 h-5 text-primary" />
            <span>Target a Technical Topic</span>
          </h3>
          <p className="text-xs text-muted-foreground">
            Generate a targeted diagnostic scenario grounded in your uploaded documents and technical journals.
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleGenerate();
          }}
          className="space-y-4"
        >
          <div>
            <label
              htmlFor="challenge-topic-input"
              className="block text-xs font-bold uppercase tracking-wider text-foreground mb-1.5"
            >
              Topic or Question Area
            </label>
            <div className="relative">
              <input
                id="challenge-topic-input"
                type="text"
                value={topic}
                onChange={(e) => {
                  setTopic(e.target.value);
                  if (generateError) setGenerateError(null);
                  if (insufficientEvidenceMsg) setInsufficientEvidenceMsg(null);
                }}
                placeholder="e.g. Memory overhead of Python lists vs dicts, Raft leader election, B-tree balance"
                className="w-full px-4 py-3 rounded-xl bg-muted/30 border border-border/80 text-sm text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>
          </div>

          {/* Quick topic suggestion pills */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>Suggested Topics from Study Library:</span>
            </span>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_TOPICS.map((sug) => (
                <button
                  key={sug}
                  type="button"
                  onClick={() => {
                    setTopic(sug);
                    if (generateError) setGenerateError(null);
                    if (insufficientEvidenceMsg) setInsufficientEvidenceMsg(null);
                  }}
                  disabled={isGenerating}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer border ${
                    topic === sug
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted/60 hover:bg-muted text-foreground border-border/60 hover:border-primary/40"
                  } disabled:opacity-50`}
                >
                  {sug}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end pt-2">
            <button
              type="submit"
              disabled={isGenerating || topic.trim().length === 0}
              className={`inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-xs transition-all shadow-sm ${
                !isGenerating && topic.trim().length > 0
                  ? "bg-primary text-primary-foreground hover:bg-primary-hover cursor-pointer"
                  : "bg-muted text-muted-foreground border border-border/60 cursor-not-allowed opacity-70"
              }`}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Synthesizing Challenge...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Generate Challenge</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Error Banner */}
      {generateError && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-900 dark:text-rose-300 text-xs flex items-center gap-3 shadow-cockpit">
          <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
          <div>
            <h4 className="font-bold">Backend Challenge Generation Failed</h4>
            <p className="mt-0.5 text-rose-800 dark:text-rose-300">{generateError}</p>
          </div>
        </div>
      )}

      {/* Insufficient Evidence Warning Banner */}
      {insufficientEvidenceMsg && (
        <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-950 dark:text-amber-200 text-xs space-y-2 shadow-cockpit">
          <div className="flex items-center gap-2 font-bold text-sm text-amber-900 dark:text-amber-100">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>Insufficient Evidence in Study Library</span>
          </div>
          <p className="leading-relaxed">{insufficientEvidenceMsg}</p>
          <p className="text-[11px] text-muted-foreground">
            Try choosing a topic specifically discussed in your uploaded documents or inspect your document vault in the Library.
          </p>
        </div>
      )}

      {/* Loading state indicator */}
      {isGenerating && (
        <div className="p-8 rounded-2xl bg-card border border-border text-center shadow-cockpit space-y-3">
          <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
          <h4 className="text-sm font-bold text-foreground">
            Synthesizing Grounded Challenge...
          </h4>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Retrieving relevant chunks and forming diagnostic questions with an expected answer rubric.
          </p>
        </div>
      )}

      {/* Explanatory Info Card */}
      <div className="p-6 rounded-2xl bg-muted/40 border border-border/60 text-xs text-muted-foreground space-y-2">
        <h4 className="font-bold text-foreground flex items-center gap-1.5">
          <HelpCircle className="w-3.5 h-3.5 text-primary" />
          <span>How Study Challenges Work</span>
        </h4>
        <p className="leading-relaxed">
          Challenges evaluate conceptual depth rather than simple keyword recall. The AI synthesizes a realistic technical scenario, extracts relevant documentation chunks, and grades your answer against a step-by-step technical rubric. Any detected misconceptions are automatically recorded in your Knowledge Gaps registry.
        </p>
      </div>
    </div>
  );
}
