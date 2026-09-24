"use client";

import React, { useState, useRef } from "react";
import { uploadDocument } from "@/lib/api";
import { UploadDocumentResponse } from "@/lib/types";
import {
  UploadCloud,
  FileText,
  X,
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
} from "lucide-react";

interface DocumentUploadProps {
  onUploadSuccess: (res: UploadDocumentResponse) => void;
}

export function DocumentUpload({ onUploadSuccess }: DocumentUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState<string>("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [status, setStatus] = useState<
    "idle" | "selected" | "uploading" | "success" | "error"
  >("idle");
  const [uploadResult, setUploadResult] =
    useState<UploadDocumentResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const processSelectedFile = (selectedFile: File) => {
    if (
      selectedFile.type !== "application/pdf" &&
      !selectedFile.name.endsWith(".pdf")
    ) {
      setErrorMessage(
        "Only PDF documents (.pdf) are supported by the ingestion engine."
      );
      setStatus("error");
      return;
    }

    setErrorMessage(null);
    setFile(selectedFile);
    setStatus("selected");

    const derivedTitle = selectedFile.name
      .replace(/\.pdf$/i, "")
      .replace(/_/g, " ");
    setTitle(derivedTitle);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processSelectedFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    setTitle("");
    setStatus("idle");
    setErrorMessage(null);
    setUploadResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const isFormValid = Boolean(file) && title.trim().length > 0;

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!file) {
      setErrorMessage("Please select a PDF file first.");
      return;
    }

    if (!title.trim()) {
      setErrorMessage("Please specify a document title.");
      return;
    }

    setStatus("uploading");
    setErrorMessage(null);

    const formData = new FormData();
    formData.append("title", title.trim());
    formData.append("file", file);

    try {
      const result = await uploadDocument(formData);
      setUploadResult(result);
      setStatus("success");
      onUploadSuccess(result);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "An unexpected upload error occurred.";
      setErrorMessage(msg);
      setStatus("error");
    }
  };

  return (
    <div className="rounded-2xl bg-card border border-border p-6 shadow-cockpit space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-4">
        <div>
          <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
            <UploadCloud className="w-5 h-5 text-primary" />
            <span>Upload Document</span>
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Automatic background ingestion pipeline (Ingest &rarr; Vector Embedding &rarr; Ready)
          </p>
        </div>

        <span className="self-start sm:self-auto text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
          Accepted Format: PDF
        </span>
      </div>

      {status === "success" && uploadResult ? (
        <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div>
              <h4 className="text-base font-bold text-emerald-950 dark:text-emerald-200">
                {uploadResult.duplicate
                  ? "Existing Document Recognized"
                  : "Document Uploaded & Pipeline Scheduled"}
              </h4>
              <p className="text-xs text-emerald-800 dark:text-emerald-300">
                {uploadResult.duplicate
                  ? "Checksum match found. Existing version retrieved."
                  : "Background ingestion & vector embedding pipeline is running automatically."}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-card/60 p-4 rounded-xl border border-emerald-500/20">
            <div>
              <span className="text-muted-foreground">Filename:</span>{" "}
              <span className="font-semibold text-foreground">
                {uploadResult.filename}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Version:</span>{" "}
              <span className="font-semibold text-foreground">
                v{uploadResult.version_number}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Initial Status:</span>{" "}
              <span className="font-semibold uppercase text-amber-700 dark:text-amber-400">
                {uploadResult.processing_status}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Duplicate:</span>{" "}
              <span className="font-semibold text-foreground">
                {uploadResult.duplicate ? "Yes (Reused)" : "No (New Upload)"}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRemoveFile}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary-hover transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Upload Another Document</span>
          </button>
        </div>
      ) : (
        <form onSubmit={handleUploadSubmit} className="space-y-5">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleFileChange}
            className="hidden"
            id="pdf-file-picker"
          />

          {!file ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 sm:p-10 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-3 ${
                isDragOver
                  ? "border-primary bg-primary/10 shadow-inner"
                  : "border-border hover:border-primary/50 bg-muted/30 hover:bg-muted/60"
              }`}
            >
              <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                <UploadCloud className="w-6 h-6" />
              </div>

              <div>
                <p className="text-sm font-bold text-foreground">
                  Click to select or drag & drop PDF document
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Supports technical specs, journals, and notes up to 50MB (.pdf)
                </p>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-muted/50 border border-border/80 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">
                    {file.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(file.size)} • PDF Document
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleRemoveFile}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-card transition-colors shrink-0"
                aria-label="Remove file"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <div>
            <label
              htmlFor="document-title-input"
              className="block text-xs font-semibold text-foreground mb-1.5"
            >
              Document Title <span className="text-rose-500">*</span>
            </label>
            <input
              id="document-title-input"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Advanced Python Hashing & Memory Specs"
              className="w-full px-3.5 py-2 rounded-xl bg-card border border-border text-sm placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>

          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={!isFormValid || status === "uploading"}
              className={`inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-sm ${
                isFormValid && status !== "uploading"
                  ? "bg-primary text-primary-foreground hover:bg-primary-hover cursor-pointer"
                  : "bg-muted text-muted-foreground border border-border/60 cursor-not-allowed opacity-70"
              }`}
            >
              {status === "uploading" ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Uploading PDF...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4" />
                  <span>Upload & Ingest PDF</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
