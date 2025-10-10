import test from "node:test";
import assert from "node:assert/strict";
import { CollaborationSocketManager } from "../CollaborationSocketManager.js";
import { ApiError } from "../../errors/ApiError.js";

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
  fn.mockRejectedValue = (error) => {
    impl = () => Promise.reject(error);
  };
  return fn;
}

function createMockIo() {
  const rooms = new Map();
  const sockets = new Map();
  const emitted = [];
  let connectionHandler = null;

  const io = {
    on: createMockFn((event, handler) => {
      if (event === "connection") {
        connectionHandler = handler;
      }
    }),
    to: createMockFn((room) => ({
      emit: (event, payload) => {
        emitted.push({ room, event, payload });
      },
    })),
    sockets: {
      adapter: {
        rooms,
      },
      sockets,
    },
    _emitConnection(socket) {
      sockets.set(socket.id, socket);
      connectionHandler?.(socket);
    },
    _emitted: emitted,
  };

  io.joinRoom = (room, socket) => {
    if (!rooms.has(room)) {
      rooms.set(room, new Set());
    }
    rooms.get(room).add(socket.id);
    sockets.set(socket.id, socket);
  };

  io.leaveRoom = (room, socket) => {
    const members = rooms.get(room);
    if (!members) return;
    members.delete(socket.id);
    if (members.size === 0) {
      rooms.delete(room);
    }
  };

  return io;
}

function createMockSocket(io, { id = "socket-1" } = {}) {
  const handlers = new Map();
  const socket = {
    id,
    data: {},
    rooms: new Set(),
    on: createMockFn((event, handler) => {
      handlers.set(event, handler);
    }),
    join: createMockFn(async (room) => {
      socket.rooms.add(room);
      io.joinRoom(room, socket);
    }),
    leave: createMockFn(async (room) => {
      socket.rooms.delete(room);
      io.leaveRoom(room, socket);
    }),
    emit: createMockFn(),
    async trigger(event, payload, callback) {
      const handler = handlers.get(event);
      if (!handler) return;
      return handler(payload, callback);
    },
  };

  return socket;
}

test.describe("CollaborationSocketManager", () => {
  let collaborationService;
  let logger;
  let manager;
  let io;
  let socket;

  test.beforeEach(() => {
    collaborationService = {
      joinSession: createMockFn(),
      recordOperation: createMockFn(),
      leaveSession: createMockFn(),
      reconnectParticipant: createMockFn(),
      proposeQuestionChange: createMockFn(),
      respondToQuestionChange: createMockFn(),
      requestSessionEnd: createMockFn(),
    };
    logger = {
      info: createMockFn(),
      warn: createMockFn(),
      error: createMockFn(),
    };
    manager = new CollaborationSocketManager({
      collaborationService,
      logger,
    });
    io = createMockIo();
    manager.bind(io);
    socket = createMockSocket(io, { id: "socket-primary" });
    io._emitConnection(socket);
  });

  test.it("joins a session and broadcasts the updated state", async () => {
    const session = { id: "session-1", participants: [] };
    collaborationService.joinSession.mockResolvedValue(session);

    const callback = createMockFn();
    await socket.trigger(
      "session:join",
      {
        sessionId: "session-1",
        userId: "user-1",
        username: "Alice",
      },
      callback,
    );

    assert.deepEqual(collaborationService.joinSession.calls[0], ["session-1", {
      userId: "user-1",
      username: "Alice",
    }]);
    assert.deepEqual(socket.data, {
      sessionId: "session-1",
      userId: "user-1",
      username: "Alice",
      hasLeft: false,
    });
    assert.ok(
      io._emitted.some(
        (entry) =>
          entry.room === "session:session-1" &&
          entry.event === "session:state" &&
          entry.payload.session === session,
      ),
    );
    assert.deepEqual(callback.calls[0], [{ ok: true, session }]);
  });

  test.it("propagates operations to the room", async () => {
    socket.data.sessionId = "session-1";
    socket.data.userId = "user-1";
    const result = { session: { id: "session-1" }, conflict: false };
    collaborationService.recordOperation.mockResolvedValue(result);

    const callback = createMockFn();
    await socket.trigger(
      "session:operation",
      { type: "insert", content: "code" },
      callback,
    );

    assert.deepEqual(collaborationService.recordOperation.calls[0], ["session-1", {
      type: "insert",
      content: "code",
      userId: "user-1",
    }]);
    assert.ok(
      io._emitted.some(
        (entry) =>
          entry.room === "session:session-1" &&
          entry.event === "session:operation" &&
          entry.payload.session === result.session &&
          entry.payload.conflict === false,
      ),
    );
    assert.deepEqual(callback.calls[0], [{ ok: true, session: result.session, conflict: false }]);
  });

  test.it("invokes the service on disconnect when there are no other active sockets", async () => {
    socket.data = {
      sessionId: "session-1",
      userId: "user-1",
      hasLeft: false,
    };
    const session = { id: "session-1" };
    collaborationService.leaveSession.mockResolvedValue(session);

    await socket.trigger("disconnect");

    assert.deepEqual(collaborationService.leaveSession.calls[0], ["session-1", {
      userId: "user-1",
      reason: "disconnect",
    }]);
    assert.ok(
      io._emitted.some(
        (entry) =>
          entry.room === "session:session-1" &&
          entry.event === "session:state" &&
          entry.payload.session === session,
      ),
    );
  });

  test.it("does not call the service on disconnect when a peer socket is active", async () => {
    const peer = createMockSocket(io, { id: "socket-peer" });
    peer.data = { sessionId: "session-1", userId: "user-1", hasLeft: false };
    io.joinRoom("session:session-1", peer);
    io._emitConnection(peer);

    socket.data = {
      sessionId: "session-1",
      userId: "user-1",
      hasLeft: false,
    };

    await socket.trigger("disconnect");

    assert.equal(collaborationService.leaveSession.calls.length, 0);
  });

  test.it("returns structured errors through the callback", async () => {
    const error = new ApiError(403, "Forbidden");
    collaborationService.joinSession.mockRejectedValue(error);
    const callback = createMockFn();

    await socket.trigger(
      "session:join",
      { sessionId: "session-1", userId: "user-1" },
      callback,
    );

    assert.deepEqual(callback.calls[0], [{
      ok: false,
      error: {
        status: 403,
        message: "Forbidden",
      },
    }]);
    assert.equal(logger.error.calls.length, 0);
  });
});
