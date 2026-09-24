"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { getDocuments } from "@/lib/api";
import { DocumentListItem, UploadDocumentResponse } from "@/lib/types";
import { DocumentUpload } from "./document-upload";
import { DocumentList } from "./document-list";
import { Sparkles, AlertTriangle, CheckCircle2, Clock } from "lucide-react";

export function LibraryWorkspace() {
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(true);
  const [isError, setIsError] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Polling state
  const [pollingNotice, setPollingNotice] = useState<string | null>(null);
  const [pollingNoticeType, setPollingNoticeType] = useState<
    "info" | "success" | "error" | "warning"
  >("info");

  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Fetch documents callback
  const fetchDocuments = useCallback(async () => {
    try {
      const res = await getDocuments();
      setDocuments(res.items);
      setIsError(false);
      return res.items;
    } catch (err) {
      console.error("Failed to fetch documents:", err);
      setIsError(true);
      return [];
    } finally {
      setIsLoadingDocuments(false);
    }
  }, []);

  // 2. Fetch documents on mount
  useEffect(() => {
    setIsLoadingDocuments(true);
    fetchDocuments();
  }, [fetchDocuments]);

  // 3. Polling cleanup helper
  const stopPolling = useCallback(() => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
    if (timeoutTimerRef.current) {
      clearTimeout(timeoutTimerRef.current);
      timeoutTimerRef.current = null;
    }
  }, []);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  // 4. Handle Upload Success & Start Polling
  const handleUploadSuccess = useCallback(
    (uploadRes: UploadDocumentResponse) => {
      // Immediately refresh documents list
      fetchDocuments();

      // If existing document returned ready immediately (duplicate)
      if (uploadRes.processing_status === "ready") {
        setPollingNotice("Document is ready for study and RAG search.");
        setPollingNoticeType("success");
        return;
      }

      // Start 1.5s polling for background pipeline status transition
      stopPolling();
      const targetDocId = uploadRes.document_id;
      setPollingNotice(
        "Background processing active: Ingesting & embedding PDF..."
      );
      setPollingNoticeType("info");

      // 60-second safety timeout guard
      timeoutTimerRef.current = setTimeout(() => {
        stopPolling();
        setPollingNotice(
          "Processing is taking longer than expected. You can refresh the Library later."
        );
        setPollingNoticeType("warning");
      }, 60000);

      // Interval timer every 1.5s
      pollingTimerRef.current = setInterval(async () => {
        const currentDocs = await fetchDocuments();
        const targetDoc = currentDocs.find(
          (d) => d.document_id === targetDocId
        );

        if (targetDoc) {
          const status = (targetDoc.processing_status || "").toLowerCase();

          // Terminal Success
          if (status === "ready") {
            stopPolling();
            setPollingNotice("Processing complete! Document is ready for study.");
            setPollingNoticeType("success");
          }
          // Terminal Failure
          else if (status === "failed" || status === "embedding_failed") {
            stopPolling();
            setPollingNotice(
              `Processing failed during pipeline execution (${targetDoc.processing_status}).`
            );
            setPollingNoticeType("error");
          }
        }
      }, 1500);
    },
    [fetchDocuments, stopPolling]
  );

  return (
    <div className="space-y-8">
      {/* Live Polling / Status Banner */}
      {pollingNotice && (
        <div
          className={`p-4 rounded-2xl border text-xs flex items-center justify-between gap-3 shadow-cockpit ${
            pollingNoticeType === "success"
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-900 dark:text-emerald-300"
              : pollingNoticeType === "error"
              ? "bg-rose-500/10 border-rose-500/20 text-rose-900 dark:text-rose-300"
              : pollingNoticeType === "warning"
              ? "bg-amber-500/10 border-amber-500/20 text-amber-900 dark:text-amber-300"
              : "bg-indigo-500/10 border-indigo-500/20 text-indigo-900 dark:text-indigo-300"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {pollingNoticeType === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : pollingNoticeType === "error" ? (
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            ) : pollingNoticeType === "warning" ? (
              <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            ) : (
              <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400 animate-spin shrink-0" />
            )}
            <span className="font-semibold">{pollingNotice}</span>
          </div>

          <button
            type="button"
            onClick={() => setPollingNotice(null)}
            className="text-xs font-semibold hover:underline opacity-80"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Upload Component */}
      <DocumentUpload onUploadSuccess={handleUploadSuccess} />

      {/* Real Document Vault */}
      <DocumentList
        documents={documents}
        isLoading={isLoadingDocuments}
        isError={isError}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />
    </div>
  );
}
