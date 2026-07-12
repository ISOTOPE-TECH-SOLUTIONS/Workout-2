# ZK API Service Documentation

This project is now **API-only** (no HTML frontend).
All normal endpoints return JSON. Live realtime endpoint returns **NDJSON** (newline-delimited JSON events).

---

## 1) Runtime model

- Service starts Flask API.
- A background worker starts automatically and continuously captures live attendance.
- If live capture crashes or disconnects (including `ConnectionAbortedError`-type issues), it auto-reconnects with retry backoff.
- If the Flask server process loop exits unexpectedly, supervisor loop auto-restarts it.
- Optional Windows tray icon is supported (if `pystray` + `Pillow` installed).

---

## 2) CORS behavior

CORS is globally open for local-network use:

- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Headers: *`
- `Access-Control-Allow-Methods: GET,POST,PUT,PATCH,DELETE,OPTIONS`

Preflight:

- `OPTIONS /`
- `OPTIONS /api/<any-path>`

Both return JSON success.

---

## 3) Global response contract

### 3.1 Standard JSON endpoints

Most endpoints use this structure:

```json
{
  "success": true,
  "message": "...",
  "...": "other endpoint-specific fields"
}
```

### 3.2 Error response format

HTTP errors and unhandled exceptions are normalized as JSON:

```json
{
  "success": false,
  "message": "Human-readable error",
  "status": 400
}
```

---

## 4) Endpoints

## 4.1 Service root

### `GET /`

Returns service metadata and live worker status.

**200 response**

```json
{
  "success": true,
  "service": "ZK API Service",
  "mode": "api-only",
  "timestamp": "2026-04-21T10:15:00",
  "live": { "running": true, "connected": true, "...": "..." },
  "endpoints": { "health": "/api/health", "...": "..." }
}
```

---

## 4.2 Health

### `GET /api/health`

Health and worker state snapshot.

**200 response**

```json
{
  "success": true,
  "timestamp": "2026-04-21T10:15:00",
  "service": "up",
  "live": { "running": true, "connected": true, "...": "..." }
}
```

---

## 4.3 User add

### `POST /api/users/add`

Pushes user data to device.

**Request JSON**

```json
{
  "address": "192.168.1.101",
  "port": 4370,
  "timeout": 10,
  "password": 0,
  "force_udp": false,
  "ommit_ping": false,

  "uid": 101,
  "user_id": "101",
  "name": "John Doe",
  "privilege": "user",
  "password": "",
  "group_id": "",
  "card": 0,
  "finger_index": 0
}
```

**Success (200)**

```json
{
  "success": true,
  "message": "User data pushed successfully. Now send fingerprint enrollment request.",
  "user": {
    "uid": 101,
    "user_id": "101",
    "name": "John Doe",
    "finger_index": 0
  }
}
```

**Common failures**

- `400`: invalid input (`user_id`, `name`, integer fields)
- `500`: device communication / pyzk errors

---

## 4.4 Finger enrollment

### `POST /api/users/enroll`

Starts remote fingerprint enrollment and validates final state using template checks.

**Request JSON**

```json
{
  "address": "192.168.1.101",
  "port": 4370,
  "timeout": 10,
  "password": 0,
  "force_udp": false,
  "ommit_ping": false,

  "uid": 101,
  "user_id": "101",
  "finger_index": 0
}
```

### Enrollment result behavior

The endpoint checks template state **before and after** remote enrollment call:

- **Success case A**: pyzk returns `True`.
- **Success case B**: pyzk uncertain/fails, but template appears after operation (`before=false`, `after=true`).
- **Conflict case**: template existed before and after (`before=true`, `after=true`) and enrollment not accepted => duplicate/re-enroll likely.
- **Failure case**: no template after operation.

**Success (200)**

```json
{
  "success": true,
  "message": "Enrollment completed for user 101 (uid 101) finger #0.",
  "user": { "uid": 101, "user_id": "101", "finger_index": 0 },
  "verification": {
    "call": "enroll_user(uid=..., temp_id=..., user_id=...)",
    "template_before": false,
    "template_after": true,
    "before_source": "get_user_template",
    "after_source": "get_user_template"
  }
}
```

**Conflict (409)**

```json
{
  "success": false,
  "message": "Finger #0 already has a template for user 101...",
  "user": { "uid": 101, "user_id": "101", "finger_index": 0 },
  "verification": { "...": "..." },
  "warnings": ["..."]
}
```

**Other failures**

- `400`: invalid input / UDP with non-numeric `user_id`
- `404`: user not found on device
- `500`: enrollment did not produce template + pyzk/device errors
- `501`: no enrollment support / inconclusive without template

---

## 4.5 User delete

### `POST /api/users/delete`

Deletes user and attempts fingerprint template cleanup first.

**Request JSON**

```json
{
  "address": "192.168.1.101",
  "port": 4370,
  "timeout": 10,
  "password": 0,
  "force_udp": false,
  "ommit_ping": false,

  "uid": 101,
  "user_id": "101"
}
```

At least one of `uid` or `user_id` is required.

**Success (200)**

```json
{
  "success": true,
  "message": "User deleted. Finger templates were removed when supported by the device.",
  "deleted_templates": 1,
  "warnings": []
}
```

---

## 4.6 Live status

### `GET /api/live/status`

Returns internal live worker state.

**200 response**

```json
{
  "success": true,
  "live": {
    "running": true,
    "thread_alive": true,
    "connected": true,
    "last_error": null,
    "last_error_at": null,
    "last_event_at": "2026-04-21T10:10:15",
    "last_heartbeat_at": "2026-04-21T10:10:20",
    "restart_count": 2,
    "current_device": "192.168.1.101:4370",
    "thread_started_at": "2026-04-21T09:55:00",
    "subscribers": 1,
    "history_size": 120
  }
}
```

---

## 4.7 Live latest snapshot

### `GET /api/live/latest?limit=50`

Returns latest persisted events from ring buffer.

**200 response**

```json
{
  "success": true,
  "count": 50,
  "events": [
    {
      "id": 123,
      "type": "attendance",
      "timestamp": "2026-04-21T10:10:15",
      "payload": {
        "uid": 101,
        "user_id": "101",
        "timestamp": "2026-04-21 10:10:15",
        "status": 0,
        "punch": 0
      }
    }
  ],
  "live": { "...": "..." }
}
```

---

## 4.8 Live stream realtime

### `GET /api/live/stream`
### `GET /api/live-records` (compat alias)

Streams realtime events as **NDJSON** (`application/x-ndjson`).

Each line is one JSON object.

Optional query:

- `history`: include last N persisted events immediately on subscribe.

#### Stream line examples

```json
{"success":true,"type":"stream_opened","timestamp":"2026-04-21T10:10:00","live":{"running":true,"connected":true}}
```

```json
{"id":124,"type":"attendance","timestamp":"2026-04-21T10:10:15","payload":{"uid":101,"user_id":"101","timestamp":"2026-04-21 10:10:15","status":0,"punch":0}}
```

```json
{"type":"keepalive","timestamp":"2026-04-21T10:10:30"}
```

---

## 4.9 Live worker restart

### `POST /api/live/restart`

Stops and starts live worker.

**200 response**

```json
{
  "success": true,
  "message": "Live capture worker restarted.",
  "worker_started": true,
  "live": { "...": "..." }
}
```

---

## 5) Connection robustness and auto-recovery

### 5.1 Live worker

- Handles network/socket exceptions.
- Handles connection-abort-like conditions.
- Publishes status events (`connected`, `error`, `reconnecting`).
- Retries indefinitely with bounded backoff.

### 5.2 Flask server loop

`run_server_forever()` wraps `app.run(...)` in an auto-restart loop.
If server exits unexpectedly, it restarts after `SERVER_RESTART_DELAY_SECONDS`.

---

## 6) Environment variables

Loaded from `.env` (if `python-dotenv` is installed):

### Core

- `HOST` (default `0.0.0.0`)
- `PORT` (default `5000`)
- `LOG_LEVEL` (default `INFO`)

### Device defaults

- `ZK_ADDRESS`
- `ZK_PORT`
- `ZK_TIMEOUT`
- `ZK_PASSWORD`
- `ZK_FORCE_UDP`
- `ZK_OMMIT_PING`

### Live worker tuning

- `LIVE_HISTORY_MAX`
- `LIVE_SUBSCRIBER_QUEUE_MAX`
- `LIVE_CAPTURE_TIMEOUT_SECONDS`
- `LIVE_STREAM_KEEPALIVE_SECONDS`
- `LIVE_RECONNECT_MIN_SECONDS`
- `LIVE_RECONNECT_MAX_SECONDS`
- `SERVER_RESTART_DELAY_SECONDS`

### Tray

- `ENABLE_TRAY_ICON` (`true`/`false`)

---

## 7) Windows EXE notes

For windowless packaging (recommended for background service):

- Use PyInstaller with no console mode (e.g. `--noconsole`).
- Keep tray enabled (`ENABLE_TRAY_ICON=true`) if you want user control UI in notification area.
- Ensure `pystray` and `Pillow` are installed for tray icon support.

---

## 8) Production/local-network notes

- CORS is open (`*`) intentionally for local-network use.
- Keep this service on trusted network segments.
- If exposure risk changes, restrict CORS and add auth.

---

## 9) Behavior summary table

| Area | Behavior |
|---|---|
| API mode | JSON-first service, no HTML frontend |
| Non-stream endpoints | Always JSON |
| Realtime | NDJSON stream (`/api/live/stream`) |
| Live startup | Auto-start worker on service startup |
| Live failure | Auto reconnect + status events |
| Server failure | Supervisor auto-restart loop |
| CORS | Wildcard (`*`) |
| Windows tray | Optional, restart live + quit |

