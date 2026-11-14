"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  getDocuments,
  deleteDocument,
  retryDocumentVersion,
} from "@/lib/api";
import { DocumentListItem, UploadDocumentResponse } from "@/lib/types";
import { DocumentUpload } from "./document-upload";
import { DocumentList } from "./document-list";
import { Sparkles, AlertTriangle, CheckCircle2, Clock } from "lucide-react";

const READY_AUTO_RESET_DELAY_MS = 2500;

export function LibraryWorkspace() {
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(true);
  const [isError, setIsError] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Active temporary upload result state
  const [activeUpload, setActiveUpload] =
    useState<UploadDocumentResponse | null>(null);

  // Action loading states
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(
    null
  );
  const [retryingVersionId, setRetryingVersionId] = useState<string | null>(
    null
  );

  // Polling / action notice state
  const [pollingNotice, setPollingNotice] = useState<string | null>(null);
  const [pollingNoticeType, setPollingNoticeType] = useState<
    "info" | "success" | "error" | "warning"
  >("info");

  const isMountedRef = useRef(true);
  const pollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activePollingDocIdRef = useRef<string | null>(null);
  const pollingSessionIdRef = useRef<number>(0);
  const fetchSeqRef = useRef<number>(0);
  const deletedDocIdsRef = useRef<Set<string>>(new Set());

  // Clear scheduled auto-reset timer
  const clearAutoResetTimer = useCallback(() => {
    if (autoResetTimerRef.current) {
      clearTimeout(autoResetTimerRef.current);
      autoResetTimerRef.current = null;
    }
  }, []);

  // Polling cleanup helper
  const stopPolling = useCallback(() => {
    pollingSessionIdRef.current += 1;
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
    if (timeoutTimerRef.current) {
      clearTimeout(timeoutTimerRef.current);
      timeoutTimerRef.current = null;
    }
    activePollingDocIdRef.current = null;
  }, []);

  // Schedule automatic reset of temporary upload-result state once Ready
  const scheduleAutoReset = useCallback(
    (docId: string) => {
      clearAutoResetTimer();
      autoResetTimerRef.current = setTimeout(() => {
        autoResetTimerRef.current = null;
        if (!isMountedRef.current) return;
        setActiveUpload((prev) =>
          prev?.document_id === docId ? null : prev
        );
        setPollingNotice(null);
      }, READY_AUTO_RESET_DELAY_MS);
    },
    [clearAutoResetTimer]
  );

  // 1. Fetch documents callback with stale-response & deleted-document guards
  const fetchDocuments = useCallback(async () => {
    const seq = ++fetchSeqRef.current;
    try {
      const res = await getDocuments();
      if (!isMountedRef.current) return [];

      const filteredItems = res.items.filter(
        (item) => !deletedDocIdsRef.current.has(item.document_id)
      );

      if (seq === fetchSeqRef.current) {
        setDocuments(filteredItems);
        setIsError(false);
      }
      return filteredItems;
    } catch (err) {
      console.error("Failed to fetch documents:", err);
      if (isMountedRef.current && seq === fetchSeqRef.current) {
        setIsError(true);
      }
      return [];
    } finally {
      if (isMountedRef.current && seq === fetchSeqRef.current) {
        setIsLoadingDocuments(false);
      }
    }
  }, []);

  // 2. Fetch documents on mount and clean up timers on unmount
  useEffect(() => {
    isMountedRef.current = true;
    setIsLoadingDocuments(true);
    fetchDocuments();

    return () => {
      isMountedRef.current = false;
      stopPolling();
      clearAutoResetTimer();
    };
  }, [fetchDocuments, stopPolling, clearAutoResetTimer]);

  // 3. Apply a polled document status update (returns true if terminal state reached)
  const applyPolledDocumentState = useCallback(
    (targetDoc: DocumentListItem): boolean => {
      const targetDocId = targetDoc.document_id;
      const status = (targetDoc.processing_status || "").toLowerCase();

      setActiveUpload((prev) =>
        prev && prev.document_id === targetDocId
          ? {
              ...prev,
              processing_status:
                targetDoc.processing_status || prev.processing_status,
            }
          : prev
      );

      if (status === "ready") {
        stopPolling();
        setPollingNotice("Processing complete! Document is ready for study.");
        setPollingNoticeType("success");
        scheduleAutoReset(targetDocId);
        return true;
      }

      if (status === "failed" || status === "embedding_failed") {
        stopPolling();
        setPollingNotice(
          `Processing failed during pipeline execution (${targetDoc.processing_status}).`
        );
        setPollingNoticeType("error");
        return true;
      }

      const stageDetail =
        status === "embedding" || status === "ready_for_embedding"
          ? "Generating vector embeddings..."
          : "Ingesting & parsing PDF...";
      setPollingNotice(
        `Background processing (${status.replace(/_/g, " ").toUpperCase()}): ${stageDetail}`
      );
      setPollingNoticeType("info");
      return false;
    },
    [stopPolling, scheduleAutoReset]
  );

  // 4. Shared 1.5s polling loop for upload & retry
  const startPollingForDocument = useCallback(
    (targetDocId: string, initialNotice: string) => {
      stopPolling();
      clearAutoResetTimer();

      const sessionId = pollingSessionIdRef.current;
      activePollingDocIdRef.current = targetDocId;
      setPollingNotice(initialNotice);
      setPollingNoticeType("info");

      // 60-second safety timeout guard
      timeoutTimerRef.current = setTimeout(() => {
        if (
          !isMountedRef.current ||
          pollingSessionIdRef.current !== sessionId ||
          activePollingDocIdRef.current !== targetDocId
        ) {
          return;
        }
        stopPolling();
        setPollingNotice(
          "Processing is taking longer than expected. You can refresh the Library later."
        );
        setPollingNoticeType("warning");
      }, 60000);

      // Interval timer every 1.5s
      pollingTimerRef.current = setInterval(async () => {
        if (
          !isMountedRef.current ||
          pollingSessionIdRef.current !== sessionId ||
          activePollingDocIdRef.current !== targetDocId ||
          deletedDocIdsRef.current.has(targetDocId)
        ) {
          stopPolling();
          return;
        }

        const currentDocs = await fetchDocuments();

        if (
          !isMountedRef.current ||
          pollingSessionIdRef.current !== sessionId ||
          activePollingDocIdRef.current !== targetDocId ||
          deletedDocIdsRef.current.has(targetDocId)
        ) {
          return;
        }

        const targetDoc = currentDocs.find(
          (d) => d.document_id === targetDocId
        );

        if (targetDoc) {
          applyPolledDocumentState(targetDoc);
        }
      }, 1500);
    },
    [fetchDocuments, stopPolling, clearAutoResetTimer, applyPolledDocumentState]
  );

  // 5. Reset temporary upload state ("Upload Another Document" or starting a new upload)
  const handleResetUpload = useCallback(() => {
    stopPolling();
    clearAutoResetTimer();
    setActiveUpload(null);
    setPollingNotice(null);
  }, [stopPolling, clearAutoResetTimer]);

  // 6. Handle Upload Success & Start Polling
  const handleUploadSuccess = useCallback(
    async (uploadRes: UploadDocumentResponse) => {
      deletedDocIdsRef.current.delete(uploadRes.document_id);
      stopPolling();
      clearAutoResetTimer();
      setActiveUpload(uploadRes);

      const initialStatus = (uploadRes.processing_status || "").toLowerCase();
      if (initialStatus === "ready") {
        setPollingNotice("Processing complete! Document is ready for study.");
        setPollingNoticeType("success");
        scheduleAutoReset(uploadRes.document_id);
        await fetchDocuments();
        return;
      }

      startPollingForDocument(
        uploadRes.document_id,
        "Background processing active: Ingesting & embedding PDF..."
      );

      const currentDocs = await fetchDocuments();
      if (
        !isMountedRef.current ||
        activePollingDocIdRef.current !== uploadRes.document_id ||
        deletedDocIdsRef.current.has(uploadRes.document_id)
      ) {
        return;
      }

      const uploadedDoc = currentDocs.find(
        (d) => d.document_id === uploadRes.document_id
      );
      if (uploadedDoc) {
        applyPolledDocumentState(uploadedDoc);
      }
    },
    [
      fetchDocuments,
      stopPolling,
      clearAutoResetTimer,
      scheduleAutoReset,
      startPollingForDocument,
      applyPolledDocumentState,
    ]
  );

  // 7. Handle Document Delete
  const handleDeleteDocument = useCallback(
    async (doc: DocumentListItem) => {
      if (deletingDocumentId) return;

      setDeletingDocumentId(doc.document_id);

      try {
        await deleteDocument(doc.document_id);

        deletedDocIdsRef.current.add(doc.document_id);

        // Immediately remove the deleted document from the vault UI
        setDocuments((prev) =>
          prev.filter((d) => d.document_id !== doc.document_id)
        );

        const isCurrentUploadDoc =
          activeUpload?.document_id === doc.document_id;
        const isCurrentPollingDoc =
          activePollingDocIdRef.current === doc.document_id;

        if (isCurrentPollingDoc || isCurrentUploadDoc) {
          stopPolling();
          clearAutoResetTimer();
        }

        if (isCurrentUploadDoc) {
          setActiveUpload(null);
        }

        // Clear any stale PENDING/Ready notice before showing deletion confirmation
        setPollingNotice(null);

        await fetchDocuments();
      } catch (err) {
        console.error("Failed to delete document:", err);
        const msg =
          err instanceof Error
            ? err.message
            : "Failed to delete document from backend.";
        setPollingNotice(msg);
        setPollingNoticeType("error");
      } finally {
        if (isMountedRef.current) {
          setDeletingDocumentId(null);
        }
      }
    },
    [
      deletingDocumentId,
      activeUpload,
      fetchDocuments,
      stopPolling,
      clearAutoResetTimer,
    ]
  );

  // 8. Handle Document Retry
  const handleRetryDocument = useCallback(
    async (doc: DocumentListItem) => {
      if (!doc.latest_version_id || retryingVersionId) return;

      setRetryingVersionId(doc.latest_version_id);

      try {
        await retryDocumentVersion(doc.latest_version_id);

        setActiveUpload((prev) =>
          prev && prev.document_id === doc.document_id
            ? { ...prev, processing_status: "pending" }
            : prev
        );

        await fetchDocuments();

        startPollingForDocument(
          doc.document_id,
          `Retrying background processing for "${doc.title}"...`
        );
      } catch (err) {
        console.error("Failed to retry document version:", err);
        const msg =
          err instanceof Error
            ? err.message
            : "Failed to retry document processing.";
        setPollingNotice(msg);
        setPollingNoticeType("error");
      } finally {
        if (isMountedRef.current) {
          setRetryingVersionId(null);
        }
      }
    },
    [retryingVersionId, fetchDocuments, startPollingForDocument]
  );

  const matchedUploadDoc = activeUpload
    ? documents.find((d) => d.document_id === activeUpload.document_id)
    : undefined;
  const liveUploadStatus =
    matchedUploadDoc?.processing_status ??
    activeUpload?.processing_status ??
    null;

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
      <DocumentUpload
        activeUpload={activeUpload}
        liveStatus={liveUploadStatus}
        onUploadStart={handleResetUpload}
        onUploadSuccess={handleUploadSuccess}
        onResetUpload={handleResetUpload}
      />

      {/* Real Document Vault */}
      <DocumentList
        documents={documents}
        isLoading={isLoadingDocuments}
        isError={isError}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onDeleteDocument={handleDeleteDocument}
        onRetryDocument={handleRetryDocument}
        deletingDocumentId={deletingDocumentId}
        retryingVersionId={retryingVersionId}
      />
    </div>
  );
}
