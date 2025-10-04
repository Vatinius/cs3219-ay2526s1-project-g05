import { sessionStore } from "./store/sessionStore.js";

const safeAck = (ack, payload) => {
  if (typeof ack === "function") {
    ack(payload);
  }
};

const resolveSessionAndUser = (socket, payload) => {
  const sessionId = payload?.sessionId ?? socket.data.sessionId;
  const userId = payload?.userId ?? socket.data.userId;

  return { sessionId, userId };
};

export const registerCollaborationHandlers = (io, { store = sessionStore } = {}) => {
  io.on("connection", (socket) => {
    socket.on("session:join", (payload, ack) => {
      try {
        const { sessionId, userId, displayName } = payload ?? {};

        if (!sessionId || !userId) {
          safeAck(ack, {
            ok: false,
            error: "sessionId and userId are required",
          });
          return;
        }

        const { participant, isNewParticipant } = store.addOrUpdateParticipant(
          sessionId,
          {
            userId,
            displayName,
            socketId: socket.id,
          }
        );

        socket.join(sessionId);
        socket.data.sessionId = sessionId;
        socket.data.userId = userId;

        const snapshot = store.getSessionSnapshot(sessionId);

        safeAck(ack, {
          ok: true,
          session: snapshot,
        });

        socket.emit("session:state", snapshot);

        socket.to(sessionId).emit("session:user-joined", {
          user: participant,
          sessionId,
          isNewParticipant,
        });
      } catch (error) {
        console.error("Failed to join session", error);
        safeAck(ack, {
          ok: false,
          error: error.message,
        });
      }
    });

    socket.on("editor:change", (payload, ack) => {
      try {
        const { sessionId, userId } = resolveSessionAndUser(socket, payload);
        const { fullText, clientVersion, changeId } = payload ?? {};

        if (!sessionId || !userId) {
          safeAck(ack, {
            ok: false,
            error: "sessionId and userId are required",
          });
          return;
        }

        if (typeof fullText !== "string") {
          safeAck(ack, {
            ok: false,
            error: "fullText must be provided as a string",
          });
          return;
        }

        const { conflict, version, lastChange } = store.applyCodeUpdate(sessionId, {
          userId,
          fullText,
          clientVersion,
          changeId,
        });

        const updatePayload = {
          sessionId,
          userId,
          fullText,
          version,
          changeId: changeId ?? lastChange?.changeId ?? null,
          conflict,
        };

        socket.to(sessionId).emit("editor:change", updatePayload);

        if (conflict) {
          io.to(sessionId).emit("editor:conflict", {
            sessionId,
            userId,
            version,
            changeId: updatePayload.changeId,
          });
        }

        safeAck(ack, {
          ok: true,
          version,
          conflict,
        });
      } catch (error) {
        console.error("Failed to apply code update", error);
        safeAck(ack, {
          ok: false,
          error: error.message,
        });
      }
    });

    socket.on("cursor:update", (payload, ack) => {
      try {
        const { sessionId, userId } = resolveSessionAndUser(socket, payload);
        const { cursor } = payload ?? {};

        if (!sessionId || !userId) {
          safeAck(ack, {
            ok: false,
            error: "sessionId and userId are required",
          });
          return;
        }

        const participant = store.updateParticipantCursor(sessionId, userId, cursor);

        if (!participant) {
          safeAck(ack, {
            ok: false,
            error: "Participant not found in session",
          });
          return;
        }

        socket.to(sessionId).emit("cursor:update", {
          sessionId,
          userId,
          cursor,
        });

        safeAck(ack, { ok: true });
      } catch (error) {
        console.error("Failed to process cursor update", error);
        safeAck(ack, {
          ok: false,
          error: error.message,
        });
      }
    });

    socket.on("session:leave", (payload, ack) => {
      try {
        const { sessionId, userId } = resolveSessionAndUser(socket, payload);

        if (!sessionId || !userId) {
          safeAck(ack, {
            ok: false,
            error: "sessionId and userId are required",
          });
          return;
        }

        store.markParticipantDisconnected(sessionId, userId);
        socket.leave(sessionId);

        socket.to(sessionId).emit("session:user-left", {
          sessionId,
          userId,
        });

        safeAck(ack, { ok: true });
      } catch (error) {
        console.error("Failed to leave session", error);
        safeAck(ack, {
          ok: false,
          error: error.message,
        });
      }
    });

    socket.on("disconnect", () => {
      const { sessionId, userId } = socket.data;

      if (!sessionId || !userId) {
        return;
      }

      const participant = store.markParticipantDisconnected(sessionId, userId);

      socket.to(sessionId).emit("session:user-disconnected", {
        sessionId,
        userId,
        participant,
      });
    });
  });
};

export default registerCollaborationHandlers;
