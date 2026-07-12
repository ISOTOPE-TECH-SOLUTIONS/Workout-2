"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useZKTeco } from "@/hooks/useZKTeco";


import { CheckCircle2, XCircle, Wallet, Fingerprint, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { normalizeDeviceTimestamp } from "@/lib/utils";

export function ScannerLiveStatus() {
    const { lastEvent, isBridgeActive } = useZKTeco();

    return (
        <div className="space-y-4">
            {/* Connection Status Header */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 border border-border/40 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${isBridgeActive ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                    <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                        Hardware Bridge: {isBridgeActive ? 'Active' : 'Offline'}
                    </span>
                </div>
                <Link 
                    href="/scanner-mapping" 
                    className="text-[10px] font-bold uppercase tracking-widest text-primary hover:underline flex items-center gap-1"
                >
                    ID Mapping <ExternalLink className="w-2.5 h-2.5" />
                </Link>
            </div>

            {/* Live Event Slot */}
            <div className="relative h-48 overflow-hidden rounded-2xl border border-border/20 bg-card/10 shadow-inner group">
                {!lastEvent ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground/40 transition-all group-hover:text-muted-foreground/60">
                        <Fingerprint className="w-12 h-12 mb-2 opacity-10 group-hover:scale-110 transition-transform duration-500" />
                        <p className="text-[10px] uppercase font-black tracking-[0.2em]">Standing By for Scans</p>
                    </div>
                ) : (
                    <div className="absolute inset-0 p-4 animate-in zoom-in-95 fade-in duration-300">
                        <div className={`h-full rounded-xl p-4 flex gap-4 items-center border shadow-lg transition-all
                            ${lastEvent.status === 'granted' ? 'bg-emerald-500/10 border-emerald-500/30 shadow-emerald-500/5' : 'bg-red-500/10 border-red-500/30 shadow-red-500/5'}
                        `}>
                            {/* Member Avatar / Status Circle */}
                            <div className={`relative flex-shrink-0 w-20 h-20 rounded-full flex items-center justify-center border-4
                                ${lastEvent.status === 'granted' ? 'border-emerald-500/50 bg-emerald-500/20' : 'border-red-500/50 bg-red-500/20'}
                            `}>
                                {lastEvent.status === 'granted' ? (
                                    <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                                ) : (
                                    <XCircle className="w-10 h-10 text-red-500" />
                                )}
                                
                                {lastEvent.member?.photo_url && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img 
                                        src={lastEvent.member.photo_url} 
                                        alt="User" 
                                        className="absolute inset-0 w-full h-full object-cover rounded-full mix-blend-overlay opacity-50"
                                    />
                                )}
                            </div>

                            {/* Details */}
                            <div className="flex-grow space-y-1">
                                <div className="flex items-center justify-between">
                                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded
                                        ${lastEvent.status === 'granted' ? 'bg-emerald-500 text-emerald-950' : 'bg-red-500 text-red-950'}
                                    `}>
                                        {lastEvent.status}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground font-mono">
                                        {formatDistanceToNow(new Date(normalizeDeviceTimestamp(lastEvent.timestamp) || ""), { addSuffix: true })}
                                    </span>
                                </div>
                                <h3 className="text-xl font-black tracking-tight">{lastEvent.member?.name || "Unknown User"}</h3>
                                
                                {lastEvent.duesInfo ? (
                                    <div className={`flex items-center gap-2 p-2 rounded-lg border leading-none
                                        ${lastEvent.duesInfo.days >= 60 ? 'bg-red-500/20 border-red-500 text-red-500' : 'bg-orange-500/10 border-orange-500/30 text-orange-500'}
                                    `}>
                                        <Wallet className="w-3.5 h-3.5" />
                                        <div className="flex-grow">
                                            <p className="font-bold text-xs">PKR {lastEvent.duesInfo.balance} Due</p>
                                            <p className="text-[8px] opacity-70 uppercase tracking-tighter">Day {lastEvent.duesInfo.days} of Billing Cycle</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 text-emerald-500/60 p-2">
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        <p className="text-[10px] uppercase font-bold tracking-widest">Account Healthy</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
