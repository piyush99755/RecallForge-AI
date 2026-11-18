"use client";

import React, { useEffect, useState } from "react";
import {
  AUTH_STATE_CHANGE_EVENT,
  getAuthMode,
  getStoredAccessToken,
  isDemoModeActive,
} from "@/lib/api";
import { AccessGate } from "./access-gate";
import { MobileBottomNav } from "./mobile-nav";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(isDemoModeActive());
  const [authReason, setAuthReason] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const initAuth = async () => {
      const modeInfo = await getAuthMode();
      if (!active) return;
      const demoActive = modeInfo.app_mode === "demo";
      setIsDemoMode(demoActive);
      setIsAuthenticated(Boolean(getStoredAccessToken()));
      setIsHydrated(true);
    };

    initAuth();

    const handleAuthChange = (event: Event) => {
      const customEvent = event as CustomEvent<{
        authenticated?: boolean;
        reason?: string;
        appMode?: string;
      }>;
      setIsDemoMode(isDemoModeActive());
      const hasToken = Boolean(getStoredAccessToken());
      setIsAuthenticated(hasToken);
      if (!hasToken && customEvent.detail?.reason) {
        setAuthReason(customEvent.detail.reason);
      } else if (hasToken) {
        setAuthReason(null);
      }
    };

    window.addEventListener(AUTH_STATE_CHANGE_EVENT, handleAuthChange);
    return () => {
      active = false;
      window.removeEventListener(AUTH_STATE_CHANGE_EVENT, handleAuthChange);
    };
  }, []);

  if (!isHydrated) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <AccessGate
        isDemoMode={isDemoMode}
        initialReason={authReason}
        onAuthenticated={() => {
          setAuthReason(null);
          setIsDemoMode(isDemoModeActive());
          setIsAuthenticated(true);
        }}
      />
    );
  }

  return (
    <div className="min-h-dvh bg-background flex flex-col lg:flex-row">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 min-h-dvh">
        <Topbar
          isDemoMode={isDemoMode}
          onToggleSidebar={() => setSidebarOpen(true)}
        />

        <main className="flex-1 pt-4 pb-[calc(5.25rem+env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:p-6 sm:pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      <MobileBottomNav />
    </div>
  );
}
