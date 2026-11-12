"use client";

import React, { useEffect, useState } from "react";
import {
  AUTH_STATE_CHANGE_EVENT,
  getStoredAccessToken,
} from "@/lib/api";
import { AccessGate } from "./access-gate";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authReason, setAuthReason] = useState<string | null>(null);

  useEffect(() => {
    setIsAuthenticated(Boolean(getStoredAccessToken()));
    setIsHydrated(true);

    const handleAuthChange = (event: Event) => {
      const customEvent = event as CustomEvent<{
        authenticated?: boolean;
        reason?: string;
      }>;
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
      window.removeEventListener(AUTH_STATE_CHANGE_EVENT, handleAuthChange);
    };
  }, []);

  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <AccessGate
        initialReason={authReason}
        onAuthenticated={() => {
          setAuthReason(null);
          setIsAuthenticated(true);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        <Topbar onToggleSidebar={() => setSidebarOpen(true)} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
