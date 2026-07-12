"use client";

import { Bell, Menu } from "lucide-react";
import Link from "next/link";

interface MobileHeaderProps {
  onMenuTrigger: () => void;
  notificationsCount?: number;
}

export function MobileHeader({ onMenuTrigger, notificationsCount = 0 }: MobileHeaderProps) {
  return (
    <header className="md:hidden flex items-center justify-between p-4 border-b border-border bg-card sticky top-0 z-30">
      <h1 className="text-xl font-bold text-emerald-500 tracking-tight">Iron Ledger</h1>
      <div className="flex items-center gap-2">
        <Link href="/notifications" className="relative p-2 hover:bg-secondary rounded-md text-muted-foreground">
          <Bell className="w-5 h-5" />
          {notificationsCount > 0 && (
            <span className="absolute -top-1 -right-1 inline-flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold px-1">
              {notificationsCount > 99 ? "99+" : notificationsCount}
            </span>
          )}
        </Link>
        <button
          onClick={onMenuTrigger}
          className="p-2 hover:bg-secondary rounded-md text-muted-foreground"
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>
    </header>
  );
}
