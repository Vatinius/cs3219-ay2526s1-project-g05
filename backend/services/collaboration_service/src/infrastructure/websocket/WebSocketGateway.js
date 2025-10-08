import { WebSocketServer } from "ws";

const MESSAGE_TYPES = {
  AUTHENTICATE: "AUTHENTICATE",
  OPERATION: "OPERATION",
  CURSOR: "CURSOR_UPDATE",
  QUESTION_PROPOSAL: "QUESTION_PROPOSAL",
  QUESTION_RESPONSE: "QUESTION_RESPONSE",
  END_SESSION_REQUEST: "END_SESSION_REQUEST",
  END_SESSION_CANCEL: "END_SESSION_CANCEL",
  HEARTBEAT: "HEARTBEAT",
};

export class WebSocketGateway {
  constructor({ sessionManager }) {
    this.sessionManager = sessionManager;
    this.connections = new Map();
  }

  attachToServer(server) {
    this.wss = new WebSocketServer({ server });
    this.wss.on("connection", (socket) => this.#handleConnection(socket));
  }

  #handleConnection(socket) {
    socket.on("message", (rawMessage) => {
      try {
        const parsed = JSON.parse(rawMessage.toString());
        this.#handleMessage(socket, parsed);
      } catch (error) {
        socket.send(
          JSON.stringify({
            type: "ERROR",
            payload: { message: "Unable to parse incoming message" },
          }),
        );
      }
    });

    socket.on("close", () => {
      const connectionContext = this.connections.get(socket);
      if (!connectionContext) {
        return;
      }

      const { sessionId, userId } = connectionContext;
      this.sessionManager.handleDisconnect({ sessionId, userId });
      const session = this.sessionManager.getSession(sessionId);
      if (session) {
        session.notifyPartnerDisconnected(userId);
      }
      this.connections.delete(socket);
    });
  }

  #handleMessage(socket, message) {
    const { type, payload } = message;

    switch (type) {
      case MESSAGE_TYPES.AUTHENTICATE:
        this.#handleAuthentication(socket, payload);
        break;
      case MESSAGE_TYPES.OPERATION:
        this.#handleOperation(socket, payload);
        break;
      case MESSAGE_TYPES.CURSOR:
        this.#handleCursor(socket, payload);
        break;
      case MESSAGE_TYPES.QUESTION_PROPOSAL:
        this.#handleQuestionProposal(socket, payload);
        break;
      case MESSAGE_TYPES.QUESTION_RESPONSE:
        this.#handleQuestionResponse(socket, payload);
        break;
      case MESSAGE_TYPES.END_SESSION_REQUEST:
        this.#handleEndSessionRequest(socket, payload);
        break;
      case MESSAGE_TYPES.END_SESSION_CANCEL:
        this.#handleEndSessionCancel(socket, payload);
        break;
      case MESSAGE_TYPES.HEARTBEAT:
        socket.send(JSON.stringify({ type: "HEARTBEAT_ACK" }));
        break;
      default:
        socket.send(
          JSON.stringify({
            type: "ERROR",
            payload: { message: `Unknown message type: ${type}` },
          }),
        );
    }
  }

  #handleAuthentication(socket, payload) {
    const { sessionId, userId, username } = payload ?? {};
    if (!sessionId || !userId) {
      socket.send(JSON.stringify({ type: "ERROR", payload: { message: "Invalid authentication payload" } }));
      return;
    }

    try {
      const { session } = this.sessionManager.registerParticipant({
        sessionId,
        userId,
        username,
        connection: socket,
      });

      this.connections.set(socket, { sessionId, userId });

      socket.send(
        JSON.stringify({
          type: "AUTHENTICATED",
          payload: session.toSummary(),
        }),
      );

      session.broadcaster.broadcastToOthers(session, userId, {
        type: "PARTNER_JOINED",
        payload: {
          userId,
          username,
        },
      });
    } catch (error) {
      socket.send(JSON.stringify({ type: "ERROR", payload: { message: error.message } }));
    }
  }

  #handleOperation(socket, payload) {
    const context = this.connections.get(socket);
    if (!context) {
      socket.send(JSON.stringify({ type: "ERROR", payload: { message: "Unauthenticated" } }));
      return;
    }

    const { sessionId, userId } = context;
    const session = this.sessionManager.getSession(sessionId);
    if (!session) {
      socket.send(JSON.stringify({ type: "ERROR", payload: { message: "Session not found" } }));
      return;
    }

    try {
      session.applyOperation({ userId, operation: payload.operation });
    } catch (error) {
      socket.send(JSON.stringify({ type: "ERROR", payload: { message: error.message } }));
    }
  }

  #handleCursor(socket, payload) {
    const context = this.connections.get(socket);
    if (!context) {
      socket.send(JSON.stringify({ type: "ERROR", payload: { message: "Unauthenticated" } }));
      return;
    }

    const { sessionId, userId } = context;
    const session = this.sessionManager.getSession(sessionId);
    if (!session) {
      socket.send(JSON.stringify({ type: "ERROR", payload: { message: "Session not found" } }));
      return;
    }

    session.broadcaster.broadcastToOthers(session, userId, {
      type: "CURSOR_UPDATED",
      payload: {
        userId,
        cursor: payload.cursor,
        selection: payload.selection,
      },
    });
  }

  #handleQuestionProposal(socket, payload) {
    const context = this.connections.get(socket);
    if (!context) {
      socket.send(JSON.stringify({ type: "ERROR", payload: { message: "Unauthenticated" } }));
      return;
    }

    const { sessionId, userId } = context;
    const session = this.sessionManager.getSession(sessionId);
    if (!session) {
      socket.send(JSON.stringify({ type: "ERROR", payload: { message: "Session not found" } }));
      return;
    }

    try {
      const result = session.requestQuestionChange(userId, payload.question);
      socket.send(JSON.stringify({ type: "QUESTION_CHANGE_STATUS", payload: result }));
    } catch (error) {
      socket.send(JSON.stringify({ type: "ERROR", payload: { message: error.message } }));
    }
  }

  #handleQuestionResponse(socket, payload) {
    const context = this.connections.get(socket);
    if (!context) {
      socket.send(JSON.stringify({ type: "ERROR", payload: { message: "Unauthenticated" } }));
      return;
    }

    const { sessionId, userId } = context;
    const session = this.sessionManager.getSession(sessionId);
    if (!session) {
      socket.send(JSON.stringify({ type: "ERROR", payload: { message: "Session not found" } }));
      return;
    }

    try {
      if (payload.accepted) {
        const result = session.requestQuestionChange(userId, payload.question);
        socket.send(JSON.stringify({ type: "QUESTION_CHANGE_STATUS", payload: result }));
      } else {
        const result = session.rejectQuestionChange(userId);
        socket.send(JSON.stringify({ type: "QUESTION_CHANGE_STATUS", payload: result }));
      }
    } catch (error) {
      socket.send(JSON.stringify({ type: "ERROR", payload: { message: error.message } }));
    }
  }

  #handleEndSessionRequest(socket, payload) {
    const context = this.connections.get(socket);
    if (!context) {
      socket.send(JSON.stringify({ type: "ERROR", payload: { message: "Unauthenticated" } }));
      return;
    }

    const { sessionId, userId } = context;
    const session = this.sessionManager.getSession(sessionId);
    if (!session) {
      socket.send(JSON.stringify({ type: "ERROR", payload: { message: "Session not found" } }));
      return;
    }

    const result = session.requestSessionEnd(userId, payload);
    socket.send(JSON.stringify({ type: "SESSION_END_STATUS", payload: result }));

    if (result.status === "ended") {
      this.sessionManager.closeSession(sessionId);
    }
  }

  #handleEndSessionCancel(socket, payload) {
    const context = this.connections.get(socket);
    if (!context) {
      socket.send(JSON.stringify({ type: "ERROR", payload: { message: "Unauthenticated" } }));
      return;
    }

    const { sessionId, userId } = context;
    const session = this.sessionManager.getSession(sessionId);
    if (!session) {
      socket.send(JSON.stringify({ type: "ERROR", payload: { message: "Session not found" } }));
      return;
    }

    session.cancelSessionEndRequest(userId);
    socket.send(JSON.stringify({ type: "SESSION_END_STATUS", payload: { status: "cancelled" } }));
  }
}

export { MESSAGE_TYPES };
