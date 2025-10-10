import test from "node:test";
import assert from "node:assert/strict";
import { CollaborationSessionService } from "../CollaborationSessionService.js";

const FIXED_NOW = new Date("2024-03-01T00:00:00.000Z");
const PAST = new Date("2024-02-28T12:00:00.000Z");

function createMockFn(impl = () => undefined) {
  const fn = (...args) => {
    fn.calls.push(args);
    return impl(...args);
  };
  fn.calls = [];
  fn.mockImplementation = (nextImpl) => {
    impl = nextImpl;
  };
  fn.mockResolvedValue = (value) => {
    impl = () => Promise.resolve(value);
  };
  return fn;
}

function createSession(overrides = {}) {
  return {
    _id: "session-1",
    roomId: "room-1",
    title: null,
    questionId: null,
    language: "javascript",
    codeSnapshot: "initial",
    version: 1,
    status: "active",
    participants: [
      {
        userId: "host",
        displayName: null,
        connected: true,
        joinedAt: PAST,
        lastSeenAt: PAST,
        disconnectedAt: null,
        reconnectBy: null,
        endConfirmed: false,
      },
    ],
    pendingQuestionChange: null,
    endRequests: [],
    cursorPositions: {},
    lastOperation: null,
    lastConflictAt: null,
    createdAt: PAST,
    updatedAt: PAST,
    ...overrides,
  };
}

test.describe("CollaborationSessionService", () => {
  let repository;
  let service;

  test.beforeEach(() => {
    repository = {
      findById: createMockFn(),
      updateById: createMockFn(),
      findByRoomId: createMockFn(),
      create: createMockFn(),
    };
    service = new CollaborationSessionService({
      repository,
      timeProvider: () => new Date(FIXED_NOW),
    });
  });

  test.it("adds a new participant when joining a session", async () => {
    repository.findById.mockResolvedValue(createSession());
    repository.updateById.mockImplementation(async (id, update) => {
      assert.equal(id, "session-1");
      assert.equal(update.set.participants.length, 2);
      const joined = update.set.participants[1];
      assert.equal(joined.userId, "guest");
      assert.equal(joined.connected, true);
      return createSession({
        participants: update.set.participants,
        status: update.set.status,
        updatedAt: FIXED_NOW,
      });
    });

    const result = await service.joinSession("session-1", { userId: "guest" });

    assert.equal(repository.updateById.calls.length, 1);
    assert.equal(result.participants.length, 2);
    const guest = result.participants.find((p) => p.userId === "guest");
    assert.ok(guest);
    assert.equal(guest.connected, true);
    assert.equal(guest.disconnectedAt, null);
    assert.equal(new Date(guest.joinedAt).toISOString(), FIXED_NOW.toISOString());
  });

  test.it("records a conflicting operation and updates metadata", async () => {
    repository.findById.mockResolvedValue(createSession());
    repository.updateById.mockImplementation(async (id, update) => {
      assert.equal(update.set.version, 2);
      assert.deepEqual(update.set.cursorPositions.host, { line: 0, column: 4, updatedAt: FIXED_NOW });
      assert.equal(update.set.lastOperation.conflict, true);
      return createSession({
        version: update.set.version,
        codeSnapshot: update.set.codeSnapshot,
        participants: update.set.participants,
        cursorPositions: update.set.cursorPositions,
        lastOperation: update.set.lastOperation,
        lastConflictAt: update.set.lastConflictAt,
      });
    });

    const result = await service.recordOperation("session-1", {
      userId: "host",
      version: 0,
      type: "insert",
      content: "updated",
      range: { start: 0, end: 0 },
      cursor: { line: 0, column: 4 },
    });

    assert.equal(repository.updateById.calls.length, 1);
    assert.equal(result.conflict, true);
    assert.equal(result.session.version, 2);
    const lastOperation = result.session.lastOperation;
    assert.ok(lastOperation);
    assert.equal(lastOperation.userId, "host");
    assert.equal(lastOperation.type, "insert");
    assert.equal(lastOperation.version, 2);
    assert.equal(lastOperation.conflict, true);
    assert.equal(new Date(lastOperation.timestamp).toISOString(), FIXED_NOW.toISOString());
  });

  test.it("returns a lock conflict without updating the session", async () => {
    const session = createSession();
    repository.findById.mockResolvedValue(session);

    service.locks.set("session-1", [
      {
        userId: "peer",
        range: { start: 0, end: 5 },
        expiresAt: new Date(FIXED_NOW.getTime() + 1000),
      },
    ]);

    const result = await service.recordOperation("session-1", {
      userId: "host",
      version: session.version,
      type: "insert",
      content: "updated",
      range: { start: 0, end: 2 },
    });

    assert.equal(repository.updateById.calls.length, 0);
    assert.equal(result.conflict, true);
    assert.equal(result.reason, "lock_conflict");
    assert.equal(result.lockedBy, "peer");
    assert.equal(result.session.id, "session-1");
  });

  test.it("marks a participant as disconnected and releases locks on leave", async () => {
    const session = createSession();
    repository.findById.mockResolvedValue(session);
    repository.updateById.mockImplementation(async (id, update) => {
      assert.equal(update.set.status, "ended");
      const participant = update.set.participants[0];
      assert.equal(participant.connected, false);
      assert.ok(participant.reconnectBy instanceof Date);
      return createSession({
        status: update.set.status,
        participants: update.set.participants,
      });
    });

    service.locks.set("session-1", [
      {
        userId: "host",
        range: { start: 0, end: 1 },
        expiresAt: new Date(FIXED_NOW.getTime() + 1000),
      },
    ]);

    const result = await service.leaveSession("session-1", { userId: "host" });

    assert.equal(repository.updateById.calls.length, 1);
    assert.equal(result.status, "ended");
    assert.equal(result.participants[0].connected, false);
    assert.equal(service.locks.get("session-1"), undefined);
  });
});
