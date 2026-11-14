"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Sparkles,
  RotateCw,
  Trophy,
  BookOpen,
  TrendingUp,
  X,
  Brain,
  ShieldCheck,
} from "lucide-react";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const NAV_ITEMS = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Ask RecallForge", href: "/ask", icon: Sparkles },
  { name: "Review", href: "/review", icon: RotateCw },
  { name: "Challenges", href: "/challenges", icon: Trophy },
  { name: "Library", href: "/library", icon: BookOpen },
  { name: "Progress", href: "/progress", icon: TrendingUp },
];

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs lg:hidden transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed top-0 left-0 z-50 h-dvh w-64 bg-card border-r border-border flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] transform transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        } lg:static lg:z-auto lg:h-auto lg:pt-0 lg:pb-0 lg:pl-0`}
      >
        {/* Header / Logo */}
        <div className="flex items-center justify-between h-16 px-6 border-b border-border shrink-0">
          <Link
            href="/"
            className="flex items-center gap-2.5 font-bold text-lg text-foreground hover:opacity-90 transition-opacity"
            onClick={onClose}
          >
            <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-sm">
              <Brain className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="flex flex-col">
              <span className="leading-tight text-base font-extrabold tracking-tight">
                RecallForge{" "}
                <span className="text-accent text-xs font-bold uppercase tracking-wider ml-0.5">
                  AI
                </span>
              </span>
              <span className="text-[10px] text-muted-foreground font-medium">
                Personal Study Engine
              </span>
            </div>
          </Link>

          <button
            type="button"
            onClick={onClose}
            className="lg:hidden text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted focus:outline-hidden focus:ring-2 focus:ring-primary/20"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Navigation list */}
        <nav aria-label="Primary" className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onClose}
                aria-current={isActive ? "page" : undefined}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
                }`}
              >
                <Icon
                  className={`w-4 h-4 ${
                    isActive ? "text-primary-foreground" : "text-muted-foreground"
                  }`}
                  aria-hidden="true"
                />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Motivational / Status footer badge */}
        <div className="p-4 m-3 rounded-2xl bg-muted/50 border border-border/60 shrink-0">
          <div className="flex items-center gap-2 mb-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            <span className="text-xs font-semibold text-foreground">
              Study Cockpit
            </span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Keep building momentum. Spaced repetition algorithm active.
          </p>
        </div>
      </aside>
    </>
  );
}
