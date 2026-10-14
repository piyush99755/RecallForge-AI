import React from "react";
import { BookOpen, FileText, Layers } from "lucide-react";

export interface CitationItem {
  source_id: string;
  chunk_id: string;
  document_title: string;
  section_title: string | null;
  page_start: number | null;
  page_end: number | null;
}

interface SourceCitationsProps {
  sources: CitationItem[];
  title?: string;
}

export function SourceCitations({
  sources,
  title = "Cited Study Sources",
}: SourceCitationsProps) {
  if (!sources || sources.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <BookOpen className="w-4 h-4 text-primary" />
        <h4 className="text-sm font-bold text-foreground">
          {title} ({sources.length})
        </h4>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {sources.map((src) => (
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
  );
}
