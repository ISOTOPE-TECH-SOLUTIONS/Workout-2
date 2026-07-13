"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * hooks/useZKTeco.ts
 *
 * Provides the last scan event for UI display (ScannerLiveStatus, GlobalPaymentAlert).
 *
 * BEFORE: Had its own Supabase Realtime subscription + 4s polling fallback.
 *         Every poll did a full `attendance_logs SELECT *` JOIN.
 * AFTER:  Reads from MemberCache. Subscribes to cache changes.
 *         Zero network calls — all data comes from cache.
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { isDummy, getMemberPaymentSnapshot } from "@/lib/supabase";
import { hardwareApi } from "@/lib/hardware-api";
import { memberCache } from "@/lib/member-cache";
import { normalizeDeviceTimestamp } from "@/lib/utils";

export type ZKScanEvent = {
    member: any;
    status: 'granted' | 'denied';
    timestamp: string;
    duesInfo: { balance: number, days: number } | null;
    notes?: string;
};

export function useZKTeco() {
    const [lastEvent, setLastEvent] = useState<ZKScanEvent | null>(null);
    const [isBridgeActive, setIsBridgeActive] = useState(false);
    const lastSeenLogIdRef = useRef<string | null>(null);
    const clearEventTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const calculateDues = (member: any) => {
        if (!member) return null;

        const paymentSnapshot = getMemberPaymentSnapshot(member);

        if (paymentSnapshot.isDue) {
            return {
                balance: paymentSnapshot.cycleDue,
                days: paymentSnapshot.daysSincePayment,
            };
        }
        return null;
    };

    const handleNewLog = useCallback((payload: any) => {
        try {
            console.log('[useZKTeco] Processing log from cache:', payload);
            const { member_id, status, timestamp, notes } = payload;

            // Look up member from cache (instant, O(1))
            let member = null;
            if (member_id) {
                member = memberCache.getMemberById(member_id);
            }

            const dues = member ? calculateDues(member) : null;
            const safeTimestamp = (typeof timestamp === 'string' && timestamp) 
                ? normalizeDeviceTimestamp(timestamp)! 
                : new Date(timestamp || Date.now()).toISOString();

            console.log('[useZKTeco] Setting last event:', { member: member?.name || notes, status, safeTimestamp });

            setLastEvent({
                member: member || { name: notes || "Unknown ID" },
                status,
                timestamp: safeTimestamp,
                duesInfo: dues,
                notes: notes || undefined
            });

            // Automatically clear event after 8 seconds.
            if (clearEventTimeoutRef.current) {
                clearTimeout(clearEventTimeoutRef.current);
            }
            clearEventTimeoutRef.current = setTimeout(() => {
                setLastEvent(null);
            }, 8000);
        } catch (error) {
            console.warn("[useZKTeco] failed to process attendance log", error);
        }
    }, []);

    useEffect(() => {
        let statusInterval: ReturnType<typeof setInterval> | null = null;

        // Check local bridge status via GET /api/health
        const checkStatus = async () => {
            try {
                const status = await hardwareApi.getStatus();
                setIsBridgeActive(!!status?.online);
            } catch (error) {
                console.warn("[useZKTeco] bridge status check failed", error);
                setIsBridgeActive(false);
            }
        };

        if (hardwareApi.isBridgePollingSupported()) {
            checkStatus();
            statusInterval = setInterval(checkStatus, 5000);
        } else {
            setIsBridgeActive(false);
        }

        // ─── Listen for new attendance logs from cache ───
        // The cache receives logs via Supabase Realtime (member-cache.ts)
        // and via local HOST pushes. We watch for changes and detect new logs.

        const checkForNewLogs = () => {
            const logs = memberCache.getRecentLogs(1);
            if (!logs || logs.length === 0) return;

            const latest = logs[0] as any;
            if (!latest?.id) return;

            // Skip first check to avoid triggering old alerts on refresh
            if (!lastSeenLogIdRef.current) {
                lastSeenLogIdRef.current = latest.id;
                return;
            }

            if (latest.id !== lastSeenLogIdRef.current) {
                lastSeenLogIdRef.current = latest.id;
                console.log('[useZKTeco] New log detected from cache:', latest.id, latest.status);
                handleNewLog(latest);
            }
        };

        // Subscribe to cache version changes (fires on new log append)
        const unsubCache = memberCache.subscribe(checkForNewLogs);

        // Prime the ref NOW with whatever the latest log already is.
        // This prevents the first real scan after page load from being
        // swallowed by the "skip first check" guard.
        const primeLogs = () => {
            const logs = memberCache.getRecentLogs(1);
            if (logs && logs.length > 0 && (logs[0] as any)?.id) {
                lastSeenLogIdRef.current = (logs[0] as any).id;
            }
        };
        // Try immediately (cache may already be ready)
        primeLogs();
        // Also try after a short delay in case initialize() hasn't finished yet
        const primeTimeout = setTimeout(primeLogs, 2000);

        // For dummy mode, also poll since cache isn't wired to Realtime
        let dummyPollInterval: ReturnType<typeof setInterval> | null = null;
        if (isDummy) {
            dummyPollInterval = setInterval(checkForNewLogs, 2000);
        }

        return () => {
            unsubCache();
            clearTimeout(primeTimeout);
            if (statusInterval) clearInterval(statusInterval);
            if (dummyPollInterval) clearInterval(dummyPollInterval);
            if (clearEventTimeoutRef.current) {
                clearTimeout(clearEventTimeoutRef.current);
            }
        };
    }, [handleNewLog]);

    return { lastEvent, isBridgeActive };
}
