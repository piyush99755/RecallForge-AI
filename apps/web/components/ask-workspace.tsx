"use client";

import React, { useState } from "react";
import { askRecallForge } from "@/lib/api";
import { AskResponse, StudyMode } from "@/lib/types";
import {
  Sparkles,
  Loader2,
  BookOpen,
  FileText,
  AlertCircle,
  HelpCircle,
  Layers,
  GraduationCap,
  Briefcase,
  Cpu,
} from "lucide-react";

export function AskWorkspace() {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<StudyMode>("beginner");
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<AskResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await askRecallForge({
        query: query.trim(),
        mode,
      });
      setResponse(res);
    } catch (err) {
      console.error("Ask request failed:", err);
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to connect to RecallForge AI backend.";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  const isInsufficientConfidence =
    response &&
    (response.sources.length === 0 ||
      response.answer.includes("couldn't find sufficiently relevant information"));

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Search Input Box */}
      <div className="rounded-2xl bg-card border border-border p-6 shadow-cockpit space-y-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
            <label
              htmlFor="ask-query-input"
              className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2"
            >
              <HelpCircle className="w-4 h-4 text-primary" />
              <span>Ask a Question</span>
            </label>

            {/* Mode Selector */}
            <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-xl border border-border/80">
              <button
                type="button"
                onClick={() => setMode("beginner")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  mode === "beginner"
                    ? "bg-card text-foreground shadow-xs border border-border"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5 text-emerald-500" />
                <span>Beginner</span>
              </button>

              <button
                type="button"
                onClick={() => setMode("interview")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  mode === "interview"
                    ? "bg-card text-foreground shadow-xs border border-border"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Briefcase className="w-3.5 h-3.5 text-amber-500" />
                <span>Interview</span>
              </button>

              <button
                type="button"
                onClick={() => setMode("senior")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  mode === "senior"
                    ? "bg-card text-foreground shadow-xs border border-border"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Cpu className="w-3.5 h-3.5 text-indigo-500" />
                <span>Senior</span>
              </button>
            </div>
          </div>

          <div className="relative">
            <textarea
              id="ask-query-input"
              rows={3}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. What are the key performance trade-offs of hash tables versus B-trees in high-throughput systems?"
              className="w-full px-4 py-3 rounded-xl bg-muted/30 border border-border/80 text-sm text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-y"
            />
          </div>

          <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>Press <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-[10px] font-mono">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-[10px] font-mono">Enter</kbd> to submit</span>

            <button
              type="submit"
              disabled={!query.trim() || isLoading}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-xs transition-all shadow-sm ${
                query.trim() && !isLoading
                  ? "bg-primary text-primary-foreground hover:bg-primary-hover cursor-pointer"
                  : "bg-muted text-muted-foreground border border-border/60 cursor-not-allowed opacity-70"
              }`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Searching & Synthesizing...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Ask RecallForge</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-900 dark:text-rose-300 text-xs flex items-center gap-3 shadow-cockpit">
          <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
          <div>
            <h4 className="font-bold">Backend Communication Error</h4>
            <p className="mt-0.5 text-rose-800 dark:text-rose-300">{error}</p>
          </div>
        </div>
      )}

      {/* Loading Indicator */}
      {isLoading && (
        <div className="p-8 rounded-2xl bg-card border border-border text-center shadow-cockpit space-y-3">
          <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
          <h4 className="text-sm font-bold text-foreground">
            Searching Study Library & Reranking Evidence...
          </h4>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Executing hybrid vector & BM25 search across your uploaded technical documents.
          </p>
        </div>
      )}

      {/* Answer & Sources Result Container */}
      {!isLoading && response && (
        <div className="space-y-6">
          {/* Grounded Answer Card */}
          <div className="p-6 rounded-2xl bg-card border border-border shadow-cockpit space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <span>Grounded Response</span>
              </h3>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 uppercase">
                {mode} mode
              </span>
            </div>

            {isInsufficientConfidence ? (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-300 text-xs space-y-2">
                <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-200">
                  <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>Insufficient Evidence in Study Library</span>
                </div>
                <p className="leading-relaxed">
                  RecallForge could not find enough supporting material in your uploaded study documents to generate a grounded answer for this query.
                </p>
              </div>
            ) : (
              <div className="prose prose-sm dark:prose-invert max-w-none text-foreground leading-relaxed whitespace-pre-line text-sm">
                {response.answer}
              </div>
            )}
          </div>

          {/* Sources Section */}
          {response.sources.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary" />
                <h4 className="text-sm font-bold text-foreground">
                  Cited Study Sources ({response.sources.length})
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {response.sources.map((src) => (
                  <div
                    key={src.source_id}
                    className="p-4 rounded-xl bg-card border border-border hover:border-primary/40 shadow-cockpit transition-all space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
                        [{src.source_id}]
                      </span>
                      {src.page_start !== null && (
                        <span className="text-[11px] font-medium text-muted-foreground">
                          {src.page_start === src.page_end
                            ? `Page ${src.page_start}`
                            : `Pages ${src.page_start}–${src.page_end}`}
                        </span>
                      )}
                    </div>

                    <div className="space-y-1">
                      <h5 className="text-xs font-bold text-foreground flex items-center gap-1.5 truncate">
                        <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate">{src.document_title}</span>
                      </h5>

                      {src.section_title && (
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1 truncate">
                          <Layers className="w-3 h-3 shrink-0" />
                          <span className="truncate">{src.section_title}</span>
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
