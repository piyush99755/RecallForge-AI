"use client";

import { Menu, Search, Sparkles } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";

interface TopbarProps {
  onToggleSidebar: () => void;
}

export function Topbar({ onToggleSidebar }: TopbarProps) {
  return (
    <header className="sticky top-0 z-30 h-16 bg-card/80 backdrop-blur-md border-b border-border px-4 sm:px-6 flex items-center justify-between gap-4 transition-colors duration-200">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="lg:hidden text-muted-foreground hover:text-foreground p-2 rounded-xl hover:bg-muted focus:outline-hidden focus:ring-2 focus:ring-primary/20 transition-colors"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Global Search Bar Placeholder */}
        <div className="relative hidden sm:block w-72 lg:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search concepts, gaps, notes..."
            className="w-full pl-9 pr-4 py-1.5 bg-muted/50 border border-border/80 rounded-xl text-sm placeholder:text-muted-foreground focus:outline-hidden focus:border-primary/50 focus:bg-card focus:ring-2 focus:ring-primary/10 transition-all"
            readOnly
          />
        </div>
      </div>

      {/* Topbar Right Slot */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="hidden sm:inline">Study Engine Ready</span>
          <span className="sm:hidden">Ready</span>
        </div>

        <button
          type="button"
          className="hidden md:flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm transition-all"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Quick Ask</span>
        </button>

        <ThemeToggle />
      </div>
    </header>
  );
}
