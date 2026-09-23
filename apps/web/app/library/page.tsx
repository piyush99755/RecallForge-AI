import React from "react";
import { SectionHeading } from "@/components/section-heading";
import { BookOpen, FolderGit2, FileCode, UploadCloud } from "lucide-react";

export default function LibraryPage() {
  return (
    <div className="space-y-6">
      <SectionHeading
        title="Study Library & Document Index"
        subtitle="Manage ingested technical journals, PDFs, repository notes, and indexed concepts"
      />

      <div className="rounded-2xl bg-card border border-border p-8 shadow-cockpit text-center max-w-3xl mx-auto my-8">
        <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto mb-4">
          <BookOpen className="w-7 h-7" />
        </div>

        <h3 className="text-xl font-bold text-foreground mb-2">
          Document & Knowledge Vault
        </h3>

        <p className="text-sm text-muted-foreground leading-relaxed max-w-lg mx-auto mb-6">
          Ingest, organize, and inspect your source documents. RecallForge AI parses headings, extracts chunks, generates vector embeddings, and builds structured concept indexes.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left mt-8 pt-6 border-t border-border/60">
          <div className="p-4 rounded-xl bg-muted/40 border border-border/50">
            <UploadCloud className="w-4 h-4 text-primary mb-2" />
            <h4 className="text-xs font-bold text-foreground">Multi-Format Parsing</h4>
            <p className="text-xs text-muted-foreground mt-1">
              Supports Markdown, PDF manuals, technical specs, and raw notes.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-muted/40 border border-border/50">
            <FolderGit2 className="w-4 h-4 text-indigo-600 mb-2" />
            <h4 className="text-xs font-bold text-foreground">Project Workspace</h4>
            <p className="text-xs text-muted-foreground mt-1">
              Group documents into distinct project scopes.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-muted/40 border border-border/50">
            <FileCode className="w-4 h-4 text-emerald-600 mb-2" />
            <h4 className="text-xs font-bold text-foreground">Chunk Hierarchy</h4>
            <p className="text-xs text-muted-foreground mt-1">
              View section boundaries, headings, and checksum hashes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
