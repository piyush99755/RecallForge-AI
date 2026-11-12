"use client";

import React, { useState } from "react";
import { DocumentListItem } from "@/lib/types";
import { DocumentStatusBadge } from "./document-status-badge";
import {
  BookOpen,
  FileText,
  Search,
  AlertCircle,
  Clock,
  Layers,
  HardDrive,
  Trash2,
  RotateCw,
  Loader2,
} from "lucide-react";

interface DocumentListProps {
  documents: DocumentListItem[];
  isLoading: boolean;
  isError: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedProjectId?: string;
  onDeleteDocument?: (doc: DocumentListItem) => Promise<void> | void;
  onRetryDocument?: (doc: DocumentListItem) => Promise<void> | void;
  deletingDocumentId?: string | null;
  retryingVersionId?: string | null;
}

const RETRYABLE_FAILED_STATUSES = new Set(["failed", "embedding_failed"]);

export function DocumentList({
  documents,
  isLoading,
  isError,
  searchQuery,
  onSearchChange,
  onDeleteDocument,
  onRetryDocument,
  deletingDocumentId,
  retryingVersionId,
}: DocumentListProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const formatFileSize = (bytes: number | null): string => {
    if (!bytes) return "Unknown size";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatDate = (isoString: string): string => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return isoString;
    }
  };

  const filteredDocuments = documents.filter((doc) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const titleMatch = doc.title.toLowerCase().includes(q);
    const fileMatch = doc.original_filename?.toLowerCase().includes(q) ?? false;
    return titleMatch || fileMatch;
  });

  return (
    <div className="space-y-4">
      {/* Header & Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-bold text-foreground">
            Ingested Documents Vault
          </h3>
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
            {documents.length} {documents.length === 1 ? "Document" : "Documents"}
          </span>
        </div>

        {/* Local Document Filter Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Filter vault documents..."
            className="w-full pl-9 pr-4 py-1.5 bg-card border border-border rounded-xl text-xs placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
        </div>
      </div>

      {/* Main Content Area */}
      {isError ? (
        <div className="rounded-2xl bg-card border border-border p-8 text-center shadow-cockpit">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-3">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h4 className="text-base font-bold text-foreground mb-1">
            Library data is temporarily unavailable.
          </h4>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Could not retrieve document list from the RecallForge API backend.
          </p>
        </div>
      ) : isLoading ? (
        <div className="rounded-2xl bg-card border border-border p-8 text-center shadow-cockpit space-y-3">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
          <p className="text-xs text-muted-foreground font-medium">
            Fetching document vault...
          </p>
        </div>
      ) : filteredDocuments.length === 0 ? (
        <div className="rounded-2xl bg-card border border-border p-8 text-center shadow-cockpit space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
            <FileText className="w-6 h-6" />
          </div>

          <h4 className="text-base font-bold text-foreground">
            {searchQuery.trim()
              ? "No matching documents found"
              : "No documents in library yet."}
          </h4>

          <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
            {searchQuery.trim()
              ? `No documents match "${searchQuery}". Try a different filter keyword.`
              : "Upload your first PDF above to begin building your personal study library."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredDocuments.map((doc) => {
            const normalizedStatus = (doc.processing_status || "").toLowerCase();
            const isRetryable =
              RETRYABLE_FAILED_STATUSES.has(normalizedStatus) &&
              Boolean(doc.latest_version_id);
            const isDeleting = deletingDocumentId === doc.document_id;
            const isRetrying =
              Boolean(doc.latest_version_id) &&
              retryingVersionId === doc.latest_version_id;
            const isConfirmingDelete = confirmDeleteId === doc.document_id;

            return (
              <div
                key={doc.document_id}
                className="p-5 rounded-2xl bg-card border border-border hover:border-primary/40 shadow-cockpit hover:shadow-cockpit-hover transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h4 className="text-base font-bold text-foreground group-hover:text-primary transition-colors truncate">
                        {doc.title}
                      </h4>
                      {doc.version_number && (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/60">
                          v{doc.version_number}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground font-medium">
                      <span className="flex items-center gap-1 truncate">
                        <FileText className="w-3.5 h-3.5 text-muted-foreground/70" />
                        {doc.original_filename || doc.title}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <HardDrive className="w-3.5 h-3.5 text-muted-foreground/70" />
                        {formatFileSize(doc.file_size_bytes)}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-muted-foreground/70" />
                        {formatDate(doc.created_at)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2.5 shrink-0 pt-3 sm:pt-0 border-t sm:border-t-0 border-border/50">
                  <span className="text-xs uppercase font-semibold text-muted-foreground/80 flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5" />
                    {doc.document_type}
                  </span>

                  <DocumentStatusBadge status={doc.processing_status} />

                  {/* Retry Processing button ONLY for failed / embedding_failed states */}
                  {isRetryable && onRetryDocument && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRetryDocument(doc);
                      }}
                      disabled={isRetrying || isDeleting}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Retry processing this document"
                    >
                      {isRetrying ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Retrying...</span>
                        </>
                      ) : (
                        <>
                          <RotateCw className="w-3.5 h-3.5" />
                          <span>Retry Processing</span>
                        </>
                      )}
                    </button>
                  )}

                  {/* Delete action with confirmation step */}
                  {onDeleteDocument && (
                    <div
                      className="flex items-center gap-1.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {isConfirmingDelete ? (
                        <>
                          <button
                            type="button"
                            onClick={async () => {
                              await onDeleteDocument(doc);
                              setConfirmDeleteId(null);
                            }}
                            disabled={isDeleting}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isDeleting ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                <span>Deleting...</span>
                              </>
                            ) : (
                              <span>Confirm Delete</span>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            disabled={isDeleting}
                            className="px-2 py-1 rounded-lg text-xs font-semibold bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground border border-border transition-colors cursor-pointer disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(doc.document_id)}
                          disabled={isDeleting || isRetrying}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          aria-label={`Delete ${doc.title}`}
                          title={`Delete ${doc.title}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
