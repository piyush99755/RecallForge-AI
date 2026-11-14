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
} from "lucide-react";

const MOBILE_NAV_ITEMS = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Ask", href: "/ask", icon: Sparkles },
  { name: "Review", href: "/review", icon: RotateCw },
  { name: "Challenges", href: "/challenges", icon: Trophy },
  { name: "Library", href: "/library", icon: BookOpen },
  { name: "Progress", href: "/progress", icon: TrendingUp },
];

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Mobile Primary"
      className="fixed bottom-0 inset-x-0 z-30 lg:hidden bg-card/95 backdrop-blur-md border-t border-border pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] shadow-cockpit"
    >
      <ul className="grid grid-cols-6 h-16 items-center px-1">
        {MOBILE_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <li key={item.name} className="h-full">
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`relative flex flex-col items-center justify-center h-full gap-1 px-1 rounded-xl transition-colors ${
                  isActive
                    ? "text-primary font-bold"
                    : "text-muted-foreground hover:text-foreground font-medium"
                }`}
              >
                {isActive && (
                  <span
                    className="absolute top-1 w-6 h-0.5 rounded-full bg-primary"
                    aria-hidden="true"
                  />
                )}
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? "text-primary" : "text-muted-foreground"
                  }`}
                  aria-hidden="true"
                />
                <span className="text-[10px] leading-none tracking-tight truncate max-w-full">
                  {item.name}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
