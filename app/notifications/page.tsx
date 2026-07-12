"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { dbService, getMemberPaymentSnapshot } from "@/lib/supabase";
import { memberCache } from "@/lib/member-cache";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Bell, 
  Calendar, 
  Wallet, 
  Phone, 
  User, 
  AlertCircle,
  Clock,
  ArrowRight
} from "lucide-react";
import Link from "next/link";

export default function NotificationsPage() {
  const cacheVersion = useSyncExternalStore(
    memberCache.subscribe,
    memberCache.getSnapshot,
    () => 0
  );

  const notifications = useMemo(() => {
    if (!memberCache.isReady()) return [];
    const members = memberCache.getAllMembers();
    return members
      .map((m) => {
        const snapshot = getMemberPaymentSnapshot(m);
        if (!snapshot.isDue) return null;
        return {
          id: m.id,
          name: m.name,
          phone: m.phone,
          balance: snapshot.cycleDue,
          daysSincePayment: snapshot.daysSincePayment,
          lastPaymentDate: snapshot.lastPaymentDate,
          type: snapshot.reason || "Monthly Dues",
        };
      })
      .filter((n): n is any => n !== null);
  }, [cacheVersion]);

  const loading = !memberCache.isReady();

  useEffect(() => {
    memberCache.initialize();
  }, []);

  const totalDues = notifications.reduce((sum, n) => sum + n.balance, 0);

  return (
    <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
           <h1 className="text-4xl font-black tracking-tighter bg-gradient-to-r from-yellow-400 to-yellow-600 bg-clip-text text-transparent italic">
             SYSTEM NOTIFICATIONS
           </h1>
           <p className="text-xs font-bold uppercase tracking-[0.3em] text-yellow-500/60 mt-1">Payment reminders and membership cycle alerts</p>
        </div>
        <div className="bg-orange-500/10 border border-orange-500/20 px-4 py-3 rounded-lg flex items-center gap-3">
           <div className="bg-orange-500 rounded-full p-2">
              <Wallet className="w-5 h-5 text-white" />
           </div>
           <div>
              <p className="text-[10px] uppercase tracking-wider text-orange-500 font-bold">Total Collection Due</p>
              <p className="text-xl font-bold font-mono">PKR {totalDues}</p>
           </div>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center p-20">
           <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
           {notifications.length === 0 ? (
              <Card className="bg-card/50 border-dashed text-center p-12">
                 <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-20" />
                 <CardTitle className="text-muted-foreground">No pending notifications</CardTitle>
                 <CardDescription>All members are up-to-date with their payments.</CardDescription>
              </Card>
           ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                 {notifications.map((notif) => (
                    <Card key={notif.id} className="bg-card/50 backdrop-blur border-border hover:border-orange-500/50 transition-colors group">
                       <CardHeader className="pb-2">
                          <div className="flex justify-between items-start">
                             <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${notif.type === 'New Cycle Reminder' ? 'bg-blue-500/20 text-blue-400' : 'bg-orange-500/20 text-orange-400'}`}>
                                {notif.type}
                             </div>
                             {notif.daysSincePayment >= 30 && (
                                <AlertCircle className="w-4 h-4 text-orange-500 animate-pulse" />
                             )}
                          </div>
                          <CardTitle className="text-lg mt-2 flex items-center gap-2">
                             <User className="w-4 h-4 text-muted-foreground" />
                             {notif.name}
                          </CardTitle>
                       </CardHeader>
                       <CardContent className="space-y-4">
                          <div className="grid grid-cols-2 gap-2 text-sm">
                             <div className="bg-background/50 p-2 rounded border border-border">
                                <p className="text-[10px] text-muted-foreground mb-1 uppercase">Amount Due</p>
                                <p className="font-bold text-emerald-500">PKR {notif.balance}</p>
                             </div>
                             <div className="bg-background/50 p-2 rounded border border-border">
                                <p className="text-[10px] text-muted-foreground mb-1 uppercase">Days Lapsed</p>
                                <p className="font-bold text-orange-500">{notif.daysSincePayment} Days</p>
                             </div>
                          </div>

                          <div className="space-y-2 pt-2 border-t border-border">
                             <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Phone className="w-3 h-3" /> {notif.phone || 'No phone'}
                             </div>
                             <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Clock className="w-3 h-3" /> Last Paid: {notif.lastPaymentDate ? new Date(notif.lastPaymentDate).toLocaleDateString("en-GB") : 'Never'}
                             </div>
                          </div>

                          <Link href="/payments" className="block">
                             <Button variant="outline" className="w-full h-8 text-xs gap-2 group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                                Go to Ledger <ArrowRight className="w-3 h-3" />
                             </Button>
                          </Link>
                       </CardContent>
                    </Card>
                 ))}
              </div>
           )}
        </div>
      )}

      <footer className="pt-10">
         <div className="bg-blue-500/5 border border-blue-500/10 p-4 rounded-lg flex items-start gap-4">
            <Calendar className="w-6 h-6 text-blue-400 mt-1" />
            <div>
               <h4 className="font-semibold text-blue-400">Payment Cycle Logic</h4>
               <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  The system automatically flags members every **30 days** starting from their last payment date. 
                  When you log a new payment in the Ledger, their cycle resets to zero for another 30 days.
               </p>
            </div>
         </div>
      </footer>
    </div>
  );
}
