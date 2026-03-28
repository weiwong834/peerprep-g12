# Collaboration Service Documentation

## Setup
**Port:** `3003`

1. Install dependencies: `npm install`
2. Start Redis: `docker run -d -p 6379:6379 --name redis-local redis:7-alpine`
3. Fill in `.env` (see `.env.example`)
4. Run: `npm run dev`

## REST API Endpoints

### `GET /health`
Health check. No auth required.

**Response:**
```json
{ "status": "ok", "service": "collaboration-service" }
```

---

### `POST /sessions`
Create a new collaboration room. Called by Matching Service — no auth token required.

**Request body:**
```json
{
  "user1_id": "uuid",
  "user2_id": "uuid",
  "language": "Python",
  "difficulty": "easy",
  "topic": "Arrays"
}
```

**Response `201`:**
```json
{
  "session_id": "uuid",
  "user1_id": "uuid",
  "user2_id": "uuid",
  "question_id": "uuid",
  "language": "Python",
  "difficulty": "easy",
  "topic": "Arrays",
  "start_timestamp": "2026-03-19T12:39:05.106+00:00",
  "end_timestamp": null,
  "status": "active",
  "code_content": ""
}
```

---

### `GET /sessions/active`
Get the calling user's current active session. Used on login to prompt rejoin (F11.2.2).

**Headers:** `Authorization: Bearer <token>`

**Response `200`:** Session object.
**Response `404`:** No active session found.

---

### `GET /sessions/:sessionId`
Get a specific session by ID. User must be a participant.

**Headers:** `Authorization: Bearer <token>`

**Response `200`:** Session object.
**Response `403`:** User is not a participant.
**Response `404`:** Session not found.

---

### `PATCH /sessions/:sessionId/end`
End a collaboration session (F11.5).

**Headers:** `Authorization: Bearer <token>`

**Response `200`:** Updated session object with `status: "inactive"` and `end_timestamp` set.
**Response `403`:** User is not a participant.
**Response `404`:** Session not found.

---

## Socket.io Events

**Connection:** `ws://localhost:3003`

### Emit (client → server)

| Event | Payload | Description |
|-------|---------|-------------|
| `join-session` | `{ sessionId, userId }` | Join a collaboration room |
| `yjs-update` | `{ sessionId, update, code }` | Send code change. `update` = Yjs binary delta, `code` = full code string |
| `end-session` | `{ sessionId, userId }` | End the session |
| `confirm-session-end` | `{ sessionId }` | Acknowledge partner's session end |

### Listen (server → client)

| Event | Payload | Description |
|-------|---------|-------------|
| `code-restored` | `{ code }` | Previous code restored from Redis on join. If Redis key is unavailable, falls back to last saved code_content from Supabase. |
| `user-joined` | `{ userId }` | Partner joined the room |
| `user-disconnected` | `{ userId }` | Partner unexpectedly disconnected |
| `yjs-update` | `{ update }` | Partner made a code change |
| `session-ended` | `{ message, endedBy }` | Session ended by partner or inactivity |
| `rejoin-available` | `{ message }` | Partner ended early, you can rejoin queue immediately |
| `idle-warning` | `{ message }` | Both users idle for 10 minutes |
| `error` | `{ message }` | Something went wrong |

---

## Inter-Service Communication

### Calls made by this service
| Method | URL | Purpose |
|--------|-----|---------|
| `GET` | `USER_SERVICE_URL/user/getUserInfo` | Verify user token |
| `POST` | `QUESTION_SERVICE_URL/internal/questions/fetch` | Fetch question on session creation |
| `POST` | `MATCHING_SERVICE_URL/internal/early-termination` | Notify of early termination (F11.7) ** endpoint TBC |

- Failed Matching Service notifications are stored in failed_notifications table and retried every 2 minutes. Entries older than 1 hour are automatically deleted as they fall outside the rolling window.

### Calls made to this service
| Caller | Method | Endpoint | Purpose |
|--------|--------|----------|---------|
| Matching Service | `POST` | `/sessions` | Create collaboration room after successful match |
| Frontend | `GET` | `/sessions/active` | Check for active session on login |
| Frontend | `GET` | `/sessions/:sessionId` | Get session details |
| Frontend | `PATCH` | `/sessions/:sessionId/end` | End session via HTTP fallback |

---

## Known Pending Items
- Matching Service early termination endpoint path TBC (`/internal/early-termination`)