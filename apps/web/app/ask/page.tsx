import React from "react";
import { SectionHeading } from "@/components/section-heading";
import { Sparkles, MessageSquare, Search, FileText } from "lucide-react";

export default function AskPage() {
  return (
    <div className="space-y-6">
      <SectionHeading
        title="Ask RecallForge AI"
        subtitle="Grounded natural-language Q&A across your technical documents, code, and project notes"
      />

      {/* Main card container */}
      <div className="rounded-2xl bg-card border border-border p-8 shadow-cockpit text-center max-w-3xl mx-auto my-8">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
          <Sparkles className="w-7 h-7" />
        </div>

        <h3 className="text-xl font-bold text-foreground mb-2">
          Grounded Conversational Assistance
        </h3>

        <p className="text-sm text-muted-foreground leading-relaxed max-w-lg mx-auto mb-6">
          Ask questions in natural language and receive precise, code-aware explanations grounded in your uploaded project documentation, notes, and technical journals with exact source citations.
        </p>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left mt-8 pt-6 border-t border-border/60">
          <div className="p-4 rounded-xl bg-muted/40 border border-border/50">
            <Search className="w-4 h-4 text-primary mb-2" />
            <h4 className="text-xs font-bold text-foreground">Hybrid Search</h4>
            <p className="text-xs text-muted-foreground mt-1">
              Combines dense vector embeddings with BM25 keyword precision.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-muted/40 border border-border/50">
            <FileText className="w-4 h-4 text-emerald-600 mb-2" />
            <h4 className="text-xs font-bold text-foreground">Exact Citations</h4>
            <p className="text-xs text-muted-foreground mt-1">
              Every response traces back to specific document sections & line ranges.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-muted/40 border border-border/50">
            <MessageSquare className="w-4 h-4 text-amber-600 mb-2" />
            <h4 className="text-xs font-bold text-foreground">Targeted Modes</h4>
            <p className="text-xs text-muted-foreground mt-1">
              Switch between beginner, interview, and senior technical depth modes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
