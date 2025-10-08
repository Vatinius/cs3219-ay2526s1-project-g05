# Collaboration Service

The collaboration service powers PeerPrep's real-time paired programming experience. It
provides a REST API and WebSocket gateway for managing collaborative rooms, synchronising
editor content, coordinating question changes and ensuring that participants can rejoin a
session within a configurable grace period.

## Getting started

```bash
pnpm install
pnpm run dev
```

The service listens on the port defined by `COLLABORATIONSERVICEPORT` (defaults to `4004`).
Swagger documentation is automatically hosted at `/docs`.

## Key capabilities

- Create, join and reconnect to collaboration rooms that support up to two participants.
- Propagate editor operations with optimistic locking and last-write-wins conflict
  resolution.
- Coordinate collaborative question changes that require mutual consent.
- Gracefully handle disconnects with a five-minute reconnection window.
- Expose WebSocket channels (via Socket.IO) for real-time updates consumed by the web app.
