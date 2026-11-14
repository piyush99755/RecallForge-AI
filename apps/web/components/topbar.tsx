"use client";

import Link from "next/link";
import { Brain, LogOut, Menu, Search, Sparkles } from "lucide-react";
import { clearStoredAccessToken } from "@/lib/api";
import { ThemeToggle } from "./theme-toggle";

interface TopbarProps {
  onToggleSidebar: () => void;
}

export function Topbar({ onToggleSidebar }: TopbarProps) {
  const handleForgetDevice = () => {
    clearStoredAccessToken(
      "Device access cleared. Enter your token to sign back in."
    );
  };

  return (
    <header className="sticky top-0 z-30 pt-[env(safe-area-inset-top)] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:px-6 bg-card/85 backdrop-blur-md border-b border-border transition-colors duration-200">
      <div className="h-14 sm:h-16 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onToggleSidebar}
            className="lg:hidden text-muted-foreground hover:text-foreground p-2 rounded-xl hover:bg-muted focus:outline-hidden focus:ring-2 focus:ring-primary/20 transition-colors shrink-0"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" aria-hidden="true" />
          </button>

          {/* Compact mobile brand identity */}
          <Link
            href="/"
            className="flex sm:hidden items-center gap-2 font-extrabold text-sm text-foreground truncate"
          >
            <span className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shadow-xs shrink-0">
              <Brain className="w-4 h-4" aria-hidden="true" />
            </span>
            <span className="tracking-tight truncate">
              RecallForge{" "}
              <span className="text-accent text-[10px] font-bold uppercase tracking-wider">
                AI
              </span>
            </span>
          </Link>

          {/* Global Search Bar Placeholder */}
          <div className="relative hidden sm:block w-72 lg:w-96">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              type="text"
              placeholder="Search concepts, gaps, notes..."
              className="w-full pl-9 pr-4 py-1.5 bg-muted/50 border border-border/80 rounded-xl text-sm placeholder:text-muted-foreground focus:outline-hidden focus:border-primary/50 focus:bg-card focus:ring-2 focus:ring-primary/10 transition-all"
              readOnly
            />
          </div>
        </div>

        {/* Topbar Right Slot */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span className="hidden sm:inline">Study Engine Ready</span>
            <span className="sm:hidden">Ready</span>
          </div>

          <Link
            href="/ask"
            className="hidden md:flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Quick Ask</span>
          </Link>

          <button
            type="button"
            onClick={handleForgetDevice}
            title="Clear stored personal access token on this device"
            aria-label="Forget device"
            className="inline-flex items-center gap-1.5 text-xs font-semibold p-2 sm:px-2.5 sm:py-1.5 rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Forget Device</span>
          </button>

          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
