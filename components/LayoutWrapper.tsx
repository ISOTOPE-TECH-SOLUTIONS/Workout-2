"use client";

import { Sidebar } from "@/components/Sidebar";
import { MobileHeader } from "@/components/MobileHeader";
import { useEffect, useState } from "react";
import { useDuesCount } from "@/hooks/useDuesCount";
import { GlobalPaymentAlert } from "@/components/GlobalPaymentAlert";
import { memberCache } from "@/lib/member-cache";

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const notificationsCount = useDuesCount();

  // Initialize cache once on app startup (any page)
  useEffect(() => {
    memberCache.initialize();

    // 1. Refresh stale cache when user returns to tab
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && memberCache.needsRefresh()) {
        memberCache.forceRefresh();
      }
    };

    // 2. Disable Arrow Keys and Mouse Wheel for Number Inputs (Prevents accidental changes)
    const handleNumberInputScroll = (e: any) => {
      if (document.activeElement?.getAttribute("type") === "number") {
        e.preventDefault();
      }
    };

    const handleNumberInputKeys = (e: any) => {
      if (
        document.activeElement?.getAttribute("type") === "number" &&
        (e.key === "ArrowUp" || e.key === "ArrowDown")
      ) {
        e.preventDefault();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    document.addEventListener("wheel", handleNumberInputScroll, { passive: false });
    document.addEventListener("keydown", handleNumberInputKeys, { passive: false });

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      document.removeEventListener("wheel", handleNumberInputScroll);
      document.removeEventListener("keydown", handleNumberInputKeys);
    };
  }, []);

  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      {/* Mobile Navigation (Header always at top on mobile) */}
      <MobileHeader onMenuTrigger={() => setIsSidebarOpen(true)} notificationsCount={notificationsCount} />

      <GlobalPaymentAlert />

      <main className="flex-1 overflow-y-auto w-full">
        {children}
      </main>

      {/* Desktop Sidebar (Repositioned to the Right) */}
      <Sidebar notificationsCount={notificationsCount} />

      {/* Mobile Sidebar (Slide-in from right) */}
      <Sidebar 
        isMobile 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)}
        notificationsCount={notificationsCount}
      />
    </div>
  );
}
