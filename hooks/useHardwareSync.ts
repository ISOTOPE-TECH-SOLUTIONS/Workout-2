"use client";
/**
 * hooks/useHardwareSync.ts
 *
 * Opens an NDJSON stream to the ZK API live endpoint and
 * synchronizes attendance events to the cloud DB (Supabase).
 *
 * HOST MODE: When bridge is detected, this device IS the host.
 * Scans are processed entirely from cache (instant fingerprint lookup),
 * results shown immediately, then pushed to Supabase asynchronously.
 * The /api/scanner server route is bypassed entirely.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { hardwareApi, StreamEvent } from "@/lib/hardware-api";
import { supabase, dbService, getMemberPaymentSnapshot, isDummy } from "@/lib/supabase";
import { memberCache } from "@/lib/member-cache";
import { normalizeDeviceTimestamp } from "@/lib/utils";

const RECONNECT_BASE_MS = 2000;
const RECONNECT_MAX_MS = 30000;
const DEVICE_LOG_PREFIX = "[DeviceBridge]";

const parseTimestampMs = (value?: string | null) => {
    const normalized = normalizeDeviceTimestamp(value);
    if (!normalized) return 0;
    const ms = Date.parse(normalized);
    return Number.isFinite(ms) ? ms : 0;
};

const pad2 = (value: number) => String(value).padStart(2, '0');

const toLocalIsoWithOffset = (date: Date = new Date()) => {
    const year = date.getFullYear();
    const month = pad2(date.getMonth() + 1);
    const day = pad2(date.getDate());
    const hours = pad2(date.getHours());
    const minutes = pad2(date.getMinutes());
    const seconds = pad2(date.getSeconds());

    const offsetMinutes = -date.getTimezoneOffset();
    const sign = offsetMinutes >= 0 ? '+' : '-';
    const absOffset = Math.abs(offsetMinutes);
    const offsetHours = pad2(Math.floor(absOffset / 60));
    const offsetMins = pad2(absOffset % 60);

    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${sign}${offsetHours}:${offsetMins}`;
};


export function useHardwareSync() {
    const [isManagerOnline, setIsManagerOnline] = useState(false);
    const [lastSyncTs, setLastSyncTs] = useState<string | null>(null);
    const abortRef = useRef<AbortController | null>(null);
    const reconnectAttemptRef = useRef(0);

    // Initialize lastSyncTs to 1 hour ago on mount (no localStorage needed)
    useEffect(() => {
        setLastSyncTs(new Date(Date.now() - 3600000).toISOString());
    }, []);

    /**
     * HOST MODE: Process scan entirely from cache.
     * 1. Lookup member by zk_id from cache (instant, O(1))
     * 2. Calculate payment status (pure computation)
     * 3. Show result instantly via cache append (triggers UI)
     * 4. Push attendance log + last_visit to Supabase (fire-and-forget)
     */
    const syncScanToCloud = useCallback(async (
        uid: number | undefined,
        userId: string | undefined,
        eventTimestamp: string,
    ) => {
        const normalizedUserId = userId || (uid != null ? String(uid) : null);
        if (!normalizedUserId) {
            console.warn(`${DEVICE_LOG_PREFIX} skipped scan with no user id`, { uid, userId });
            return;
        }

        const normalizedTimestamp = normalizeDeviceTimestamp(eventTimestamp);
        console.log(`${DEVICE_LOG_PREFIX} processing scan`, { normalizedUserId, eventTimestamp });

        try {
            // ─── HOST MODE: Cache-first processing ───
            // Ensure cache is ready
            if (!memberCache.isReady()) {
                await memberCache.initialize();
            }

            // Instant member lookup from cache (O(1) Map.get)
            const member = memberCache.getMemberByScannerId(normalizedUserId);

            if (!member) {
                console.warn(`${DEVICE_LOG_PREFIX} member not found for scanner ID`, { normalizedUserId });

                // Log unknown scan to Supabase
                const unknownNote = `Unknown Scanner ID: ${normalizedUserId}`;
                await dbService.logAttendance(null, 'denied', unknownNote, normalizedTimestamp || undefined);
                return;
            }

            // Calculate payment status from cached member data (pure computation)
            const snapshot = getMemberPaymentSnapshot(member);
            const status: 'granted' | 'denied' = snapshot.isDue ? 'denied' : 'granted';
            const notes = snapshot.isDue ? (snapshot.reason || 'Outstanding Balance') : undefined;

            console.log(`${DEVICE_LOG_PREFIX} HOST: ${member.name} → ${status}`, {
                isDue: snapshot.isDue,
                cycleDue: snapshot.cycleDue,
            });

            // Push attendance log to Supabase (also updates cache via dbService)
            await dbService.logAttendance(member.id, status, notes, normalizedTimestamp || undefined);

            // Update last_visit in Supabase + cache
            const nowIso = toLocalIsoWithOffset();
            if (!isDummy) {
                supabase.from('members')
                    .update({ last_visit: nowIso })
                    .eq('id', member.id)
                    .then(({ error }) => {
                        if (error) console.warn(`${DEVICE_LOG_PREFIX} failed to update last_visit`, error);
                    });
            }
            memberCache.upsertMember({ id: member.id, last_visit: nowIso });

        } catch (e) {
            console.error(`${DEVICE_LOG_PREFIX} failed to sync scan`, { normalizedUserId, error: e });
        }

        // Update last processed timestamp (in-memory only)
        const eventMs = parseTimestampMs(eventTimestamp);
        if (eventMs > 0) {
            const latestTs = new Date(eventMs).toISOString();
            setLastSyncTs(latestTs);
        }
    }, []);

    const startStream = useCallback(async () => {
        // Abort any existing stream before starting a new one.
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        try {
            console.log(`${DEVICE_LOG_PREFIX} connecting to live stream...`);
            const stream = hardwareApi.connectStream(10, controller.signal);

            for await (const event of stream) {
                // Reset reconnect backoff on any successful event.
                reconnectAttemptRef.current = 0;

                if (event.type === "stream_opened") {
                    console.log(`${DEVICE_LOG_PREFIX} stream opened`, event);
                    setIsManagerOnline(true);
                    continue;
                }

                if (event.type === "keepalive") {
                    continue;
                }

                if (event.type === "attendance") {
                    const att = event as Extract<StreamEvent, { type: "attendance" }>;
                    const payload = att.payload;
                    await syncScanToCloud(
                        payload.uid,
                        payload.user_id,
                        payload.timestamp || att.timestamp,
                    );
                }
            }

            // Stream ended normally (server closed it).
            console.warn(`${DEVICE_LOG_PREFIX} stream ended`);
        } catch (err: any) {
            if (err?.name === "AbortError") {
                console.log(`${DEVICE_LOG_PREFIX} stream aborted`);
                return; // intentional abort, don't reconnect
            }
            console.error(`${DEVICE_LOG_PREFIX} stream error`, err);
        }

        setIsManagerOnline(false);

        // Reconnect with backoff.
        if (!controller.signal.aborted) {
            const attempt = reconnectAttemptRef.current++;
            const delay = Math.min(RECONNECT_BASE_MS * Math.pow(2, attempt), RECONNECT_MAX_MS);
            console.log(`${DEVICE_LOG_PREFIX} reconnecting in ${delay}ms (attempt ${attempt + 1})`);
            setTimeout(() => {
                if (!controller.signal.aborted) {
                    startStream();
                }
            }, delay);
        }
    }, [syncScanToCloud]);

    // Initial health check + kickoff stream
    useEffect(() => {
        if (typeof window === "undefined") return;

        let cancelled = false;

        const init = async () => {
            // Ensure cache is initialized before starting stream
            await memberCache.initialize();

            // Quick health check first
            const status = await hardwareApi.getStatus();
            if (cancelled) return;

            if (status) {
                setIsManagerOnline(true);
                startStream();
            } else {
                setIsManagerOnline(false);
                // Retry health check periodically until online
                const retryInterval = setInterval(async () => {
                    if (cancelled) {
                        clearInterval(retryInterval);
                        return;
                    }
                    const s = await hardwareApi.getStatus();
                    if (s) {
                        setIsManagerOnline(true);
                        clearInterval(retryInterval);
                        startStream();
                    }
                }, 5000);
            }
        };

        init();

        return () => {
            cancelled = true;
            abortRef.current?.abort();
        };
    }, [startStream]);

    return { isManagerOnline, lastSyncTs };
}
