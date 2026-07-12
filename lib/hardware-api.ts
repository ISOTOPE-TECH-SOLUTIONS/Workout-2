/**
 * lib/hardware-api.ts
 * Client for the ZK API Service (default 127.0.0.1:5000)
 *
 * New API contract:
 *   - All endpoints return JSON with { success, message, ...data }
 *   - Live stream returns NDJSON (newline-delimited JSON)
 *   - Two-step enrollment: addUser() then enrollFinger()
 */

/* ────────────────────────── Base URL Resolution ────────────────────────── */

const EXPLICIT_BASE_URL = (process.env.NEXT_PUBLIC_ZK_API_BASE_URL || "").trim();
const PROXY_BASE_URL = "/api/hardware-bridge";
const LOCAL_DEVICE_BASE_URL = (process.env.NEXT_PUBLIC_ZK_LOCAL_BRIDGE_URL || "http://127.0.0.1:5000").trim();
const FORCE_PROXY = (process.env.NEXT_PUBLIC_ZK_FORCE_PROXY || "").trim().toLowerCase() === "true";

const isLoopbackHost = (hostname: string) => {
    const normalized = hostname.toLowerCase();
    return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
};

const getSafeHostname = () => {
    try {
        if (typeof window === "undefined") return "";
        return String(window.location?.hostname || "").toLowerCase();
    } catch {
        return "";
    }
};

const resolveBaseUrl = () => {
    if (EXPLICIT_BASE_URL) return EXPLICIT_BASE_URL;
    if (FORCE_PROXY) return PROXY_BASE_URL;

    // By default, try to talk to the local bridge directly.
    // This works on localhost and on the local network (if IP is configured).
    return LOCAL_DEVICE_BASE_URL;
};

const buildApiUrl = (path: string) => `${resolveBaseUrl()}${path}`;

/* ────────────────────────── Helpers ────────────────────────── */

const HARDWARE_LOG_PREFIX = "[HardwareAPI]";

const toPositiveInt = (value: string | undefined, fallback: number) => {
    const parsed = Number.parseInt(String(value ?? ""), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const BRIDGE_STATUS_TIMEOUT_MS = toPositiveInt(process.env.NEXT_PUBLIC_ZK_HEALTH_TIMEOUT_MS, 5000);

const createTimeoutSignal = (timeoutMs: number): AbortSignal | undefined => {
    if (typeof AbortSignal !== "undefined" && typeof (AbortSignal as any).timeout === "function") {
        return (AbortSignal as any).timeout(timeoutMs) as AbortSignal;
    }
    if (typeof AbortController !== "undefined") {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), timeoutMs);
        return controller.signal;
    }
    return undefined;
};

/* ────────────────────── Device Connection Config ────────────────────── */

export type ZKDeviceConfig = {
    address?: string;
    port?: number;
    timeout?: number;
    password?: number;
    force_udp?: boolean;
    ommit_ping?: boolean;
};

const SHARED_DEVICE_CONFIG: ZKDeviceConfig = {
    address: (process.env.NEXT_PUBLIC_ZK_DEVICE_ADDRESS || "").trim() || undefined,
    port: toPositiveInt(process.env.NEXT_PUBLIC_ZK_DEVICE_PORT, 4370),
    timeout: toPositiveInt(process.env.NEXT_PUBLIC_ZK_DEVICE_TIMEOUT, 10),
    password: Number.parseInt(process.env.NEXT_PUBLIC_ZK_DEVICE_PASSWORD || "0", 10) || 0,
    force_udp: (process.env.NEXT_PUBLIC_ZK_FORCE_UDP || "").trim().toLowerCase() === "true",
    ommit_ping: (process.env.NEXT_PUBLIC_ZK_OMMIT_PING || "").trim().toLowerCase() === "true",
};

/* ────────────────────────── Types ────────────────────────── */

export type HardwareStatus = {
    online: boolean;
    live_running: boolean;
    live_connected: boolean;
    service?: string;
    timestamp?: string;
};

export type HardwareEvent = {
    ts: string;
    type: "live" | "add_user" | "delete_user" | "live_start" | "live_stop";
    payload: {
        uid?: number;
        user_id?: string;
        timestamp?: string;
        status?: number;
        punch?: number;
    };
};

// Step 1: Add user data to device
export type ZKAddUserPayload = {
    uid: number;
    user_id: string;
    name: string;
    privilege?: string;
    password?: string;
    group_id?: string;
    card?: number;
    finger_index?: number;
};

export type ZKAddUserResult = {
    success: boolean;
    message: string;
    user?: {
        uid: number;
        user_id: string;
        name: string;
        finger_index: number;
    };
};

// Step 2: Enroll fingerprint
export type ZKEnrollPayload = {
    uid: number;
    user_id: string;
    finger_index?: number;
};

export type ZKEnrollResult = {
    success: boolean;
    message: string;
    user?: {
        uid: number;
        user_id: string;
        finger_index: number;
    };
    verification?: {
        call?: string;
        template_before?: boolean;
        template_after?: boolean;
        before_source?: string;
        after_source?: string;
    };
    warnings?: string[];
};

// Delete user
export type ZKDeleteUserPayload = {
    uid?: number;
    user_id?: string;
};

export type ZKDeleteUserResult = {
    success: boolean;
    message: string;
    deleted_templates?: number;
    warnings?: string[];
};

// Backward-compat exports for consumers that reference old types
export type HardwareAddUserResult = ZKAddUserResult & {
    ok?: boolean;
    uid?: number;
    user_id?: string;
    name?: string;
    enrollStep?: "data_pushed" | "finger_enrolled";
};

/* ────────────────────── API Response Helpers ────────────────────── */

type ApiJsonResponse = {
    success: boolean;
    message?: string;
    [key: string]: unknown;
};

const postJson = async (
    endpoint: string,
    payload: Record<string, unknown>,
    timeoutMs = 30_000,
): Promise<ApiJsonResponse> => {
    console.log(`${HARDWARE_LOG_PREFIX} POST ${endpoint}`, payload);

    const res = await fetch(buildApiUrl(endpoint), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: createTimeoutSignal(timeoutMs),
    });

    const json: ApiJsonResponse = await res.json().catch(() => ({
        success: false,
        message: `HTTP ${res.status}: non-JSON response`,
    }));

    if (!res.ok || json.success === false) {
        const errorMsg = json.message || `Request failed with status ${res.status}`;
        const error = new Error(errorMsg) as Error & { status: number; body: ApiJsonResponse };
        error.status = res.status;
        error.body = json;
        throw error;
    }

    return json;
};

const getJson = async (
    endpoint: string,
    timeoutMs = 10_000,
): Promise<ApiJsonResponse> => {
    const res = await fetch(buildApiUrl(endpoint), {
        signal: createTimeoutSignal(timeoutMs),
    });

    const json: ApiJsonResponse = await res.json().catch(() => ({
        success: false,
        message: `HTTP ${res.status}: non-JSON response`,
    }));

    if (!res.ok || json.success === false) {
        const errorMsg = json.message || `Request failed with status ${res.status}`;
        throw new Error(errorMsg);
    }

    return json;
};

/* ────────────────────── Scanner ID Normalization ────────────────────── */

const normalizeScannerIdentity = (uid: unknown, userId: unknown) => {
    const rawUserId = String(userId ?? "").trim();
    const uidFromPayload = Number.isInteger(uid) ? Number(uid) : Number.parseInt(rawUserId, 10);

    if (!Number.isInteger(uidFromPayload) || uidFromPayload <= 0) {
        throw new Error("Scanner ID must be a positive number. uid and user_id must match.");
    }

    return {
        uid: uidFromPayload,
        user_id: String(uidFromPayload),
    };
};

/* ────────────────────── NDJSON Stream Helpers ────────────────────── */

export type StreamEvent =
    | { type: "stream_opened"; success: boolean; timestamp: string; live?: Record<string, unknown> }
    | { type: "attendance"; id: number; timestamp: string; payload: { uid: number; user_id: string; timestamp: string; status: number; punch: number } }
    | { type: "keepalive"; timestamp: string }
    | { type: "status"; timestamp: string; [key: string]: unknown };

const parseNdjsonLine = (line: string): StreamEvent | null => {
    const trimmed = line.trim();
    if (!trimmed) return null;
    try {
        return JSON.parse(trimmed) as StreamEvent;
    } catch {
        return null;
    }
};

/* ──────────────────────── Exported API Object ──────────────────────── */

export const hardwareApi = {
    /**
     * Check if we're in a browser environment (required for bridge polling/streaming).
     */
    isBridgePollingSupported() {
        return typeof window !== "undefined";
    },

    /**
     * Check ZK API health.
     * GET /api/health → { success, timestamp, service, live: { running, connected, ... } }
     */
    async getStatus(): Promise<HardwareStatus | null> {
        try {
            if (typeof window === "undefined") return null;

            const json = await getJson("/api/health", BRIDGE_STATUS_TIMEOUT_MS);
            const live = (json.live || {}) as Record<string, unknown>;

            return {
                online: true,
                live_running: !!live.running,
                live_connected: !!live.connected,
                service: String(json.service ?? "up"),
                timestamp: String(json.timestamp ?? ""),
            };
        } catch (e) {
            console.error(`${HARDWARE_LOG_PREFIX} getStatus failed`, e);
            return null;
        }
    },

    /**
     * Step 1: Push user data to the device.
     * POST /api/users/add
     */
    async addUser(payload: ZKAddUserPayload): Promise<ZKAddUserResult> {
        const identity = normalizeScannerIdentity(payload.uid, payload.user_id);
        const name = String(payload.name ?? "").trim();
        if (!name) throw new Error("Name is required.");

        const requestPayload: Record<string, unknown> = {
            ...SHARED_DEVICE_CONFIG,
            uid: identity.uid,
            user_id: identity.user_id,
            name,
            privilege: payload.privilege ?? "user",
            password: payload.password ?? "",
            group_id: payload.group_id ?? "",
            card: payload.card ?? 0,
            finger_index: payload.finger_index ?? 0,
        };

        const json = await postJson("/api/users/add", requestPayload, 30_000);
        console.log(`${HARDWARE_LOG_PREFIX} addUser success`, json);

        return {
            success: true,
            message: String(json.message ?? "User data pushed."),
            user: (json.user || { uid: identity.uid, user_id: identity.user_id, name, finger_index: 0 }) as ZKAddUserResult["user"],
        };
    },

    /**
     * Step 2: Start fingerprint enrollment on the device.
     * POST /api/users/enroll
     *
     * This is a blocking call — the device will prompt the user to
     * place their finger. It returns once enrollment completes or fails.
     */
    async enrollFinger(payload: ZKEnrollPayload): Promise<ZKEnrollResult> {
        const identity = normalizeScannerIdentity(payload.uid, payload.user_id);

        const requestPayload: Record<string, unknown> = {
            ...SHARED_DEVICE_CONFIG,
            uid: identity.uid,
            user_id: identity.user_id,
            finger_index: payload.finger_index ?? 0,
        };

        // Enrollment can take a while (user must place finger multiple times).
        // Use a generous timeout.
        const json = await postJson("/api/users/enroll", requestPayload, 120_000);
        console.log(`${HARDWARE_LOG_PREFIX} enrollFinger result`, json);

        return {
            success: json.success,
            message: String(json.message ?? ""),
            user: json.user as ZKEnrollResult["user"],
            verification: json.verification as ZKEnrollResult["verification"],
            warnings: json.warnings as string[] | undefined,
        };
    },

    /**
     * Delete a user from the device (including fingerprint templates).
     * POST /api/users/delete
     */
    async deleteUser(payload: ZKDeleteUserPayload): Promise<ZKDeleteUserResult> {
        const hasUid = payload.uid != null && Number.isInteger(payload.uid) && payload.uid > 0;
        const hasUserId = typeof payload.user_id === "string" && payload.user_id.trim().length > 0;

        if (!hasUid && !hasUserId) {
            throw new Error("Provide at least one selector: uid or user_id.");
        }

        const requestPayload: Record<string, unknown> = {
            ...SHARED_DEVICE_CONFIG,
        };
        if (hasUid) requestPayload.uid = payload.uid;
        if (hasUserId) requestPayload.user_id = payload.user_id!.trim();

        const json = await postJson("/api/users/delete", requestPayload, 30_000);
        console.log(`${HARDWARE_LOG_PREFIX} deleteUser success`, json);

        return {
            success: json.success,
            message: String(json.message ?? "User deleted."),
            deleted_templates: json.deleted_templates as number | undefined,
            warnings: json.warnings as string[] | undefined,
        };
    },

    /**
     * Get live worker status.
     * GET /api/live/status
     */
    async getLiveStatus() {
        return getJson("/api/live/status", 5000);
    },

    /**
     * Get latest attendance events from ring buffer.
     * GET /api/live/latest?limit=N
     */
    async getLiveLatest(limit = 50) {
        const json = await getJson(`/api/live/latest?limit=${limit}`, 10_000);
        return {
            count: json.count as number,
            events: (json.events || []) as Array<{
                id: number;
                type: string;
                timestamp: string;
                payload: {
                    uid: number;
                    user_id: string;
                    timestamp: string;
                    status: number;
                    punch: number;
                };
            }>,
        };
    },

    /**
     * Restart the live worker.
     * POST /api/live/restart
     */
    async restartLive() {
        return postJson("/api/live/restart", {}, 10_000);
    },

    /**
     * Open NDJSON stream for real-time attendance events.
     * GET /api/live/stream
     *
     * Returns an async generator of parsed stream events.
     * Caller is responsible for iterating and handling reconnect.
     */
    async *connectStream(
        history = 0,
        abortSignal?: AbortSignal,
    ): AsyncGenerator<StreamEvent, void, unknown> {
        const url = buildApiUrl(`/api/live/stream${history > 0 ? `?history=${history}` : ""}`);
        console.log(`${HARDWARE_LOG_PREFIX} opening NDJSON stream`, url);

        const res = await fetch(url, {
            signal: abortSignal,
            headers: { Accept: "application/x-ndjson" },
        });

        if (!res.ok || !res.body) {
            throw new Error(`Stream connection failed: HTTP ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        try {
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                // Keep the last (possibly incomplete) line in the buffer.
                buffer = lines.pop() || "";

                for (const line of lines) {
                    const event = parseNdjsonLine(line);
                    if (event) yield event;
                }
            }

            // Flush remaining buffer.
            if (buffer.trim()) {
                const event = parseNdjsonLine(buffer);
                if (event) yield event;
            }
        } finally {
            reader.releaseLock();
        }
    },
};
