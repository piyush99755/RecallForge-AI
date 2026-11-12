"use client";

import React, { useState } from "react";
import {
  setStoredAccessToken,
  verifyAccessToken,
} from "@/lib/api";
import {
  BrainCircuit,
  KeyRound,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";

interface AccessGateProps {
  initialReason?: string | null;
  onAuthenticated: () => void;
}

export function AccessGate({
  initialReason,
  onAuthenticated,
}: AccessGateProps) {
  const [tokenInput, setTokenInput] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(
    initialReason || null
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = tokenInput.trim();
    if (!cleaned) {
      setErrorMessage("Please enter your personal access token.");
      return;
    }

    setIsVerifying(true);
    setErrorMessage(null);

    try {
      await verifyAccessToken(cleaned);
      setStoredAccessToken(cleaned);
      setTokenInput("");
      onAuthenticated();
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Could not verify personal access token.";
      setErrorMessage(msg);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-3xl bg-card border border-border p-7 sm:p-8 shadow-cockpit space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <BrainCircuit className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
              RecallForge AI
            </span>
            <h1 className="text-lg font-extrabold text-foreground leading-tight">
              Personal Study Engine Access
            </h1>
          </div>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          Enter your personal API access token to unlock your study vault,
          spaced repetition queue, and grounded Q&amp;A workspace on this
          device.
        </p>

        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="personal-access-token"
              className="block text-xs font-semibold text-foreground"
            >
              Personal Access Token
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="personal-access-token"
                type="password"
                autoComplete="current-password"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Enter API_ACCESS_TOKEN..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-muted/40 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                disabled={isVerifying}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isVerifying || !tokenInput.trim()}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary-hover disabled:opacity-50 transition-all shadow-sm cursor-pointer"
          >
            <span>
              {isVerifying ? "Verifying Access..." : "Unlock Study Engine"}
            </span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        <div className="pt-4 border-t border-border/60 flex items-start gap-2 text-[11px] text-muted-foreground">
          <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
          <span>
            Your credential is stored locally on this browser and sent via{" "}
            <code className="text-foreground font-mono">
              Authorization: Bearer
            </code>
            . Use <strong>Forget Device</strong> in the top bar anytime to clear
            access.
          </span>
        </div>
      </div>
    </div>
  );
}
