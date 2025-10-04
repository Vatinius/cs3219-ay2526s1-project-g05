# Collaboration Service

The collaboration service exposes the backend capabilities that power PeerPrep's
real-time pair programming experience. It offers REST endpoints for
session lifecycle management and a Socket.IO gateway that synchronises the
shared code editor between two matched users.

## Getting started

```
pnpm install
pnpm dev
```

The service listens on the port defined by `COLLABORATION_SERVICE_PORT` (defaults
to `4004`).

### Environment variables

| Variable | Description |
| --- | --- |
| `COLLABORATION_SERVICE_PORT` | Port for the HTTP and WebSocket server. |
| `COLLABORATION_CORS_ORIGIN` | Comma separated list of origins that are allowed to connect to the service. |

## REST API

`GET /status`
: Health check endpoint.

`POST /sessions`
: Creates (or returns) an in-memory collaboration session. Payload accepts
`sessionId`, optional `initialCode`, and optional `question` metadata.

`GET /sessions/:sessionId`
: Fetches the current snapshot for a session.

`POST /sessions/:sessionId/question`
: Updates the active question for the session and notifies connected clients.

## Socket events

All events expect the client to supply the `sessionId` that they are connected
with. The server stores the latest session state and will broadcast relevant
updates to the counterpart in the room.

`session:join`
: `{ sessionId, userId, displayName? }` → responds with the full session
snapshot and notifies the other participant that a user has joined.

`editor:change`
: `{ sessionId, userId, fullText, clientVersion?, changeId? }` → updates the
shared document and broadcasts the new revision to the other participant. The
server applies optimistic concurrency and emits `editor:conflict` if an update
is accepted while overwriting a newer revision (last-write-wins).

`cursor:update`
: `{ sessionId, userId, cursor }` → keeps peer cursors in sync.

`session:leave`
: `{ sessionId, userId }` → marks the user as disconnected and leaves the room.

`session:user-disconnected`
: Broadcast from the server when a socket disconnects unexpectedly so that the
remaining participant can react (e.g. start a reconnection grace period).
