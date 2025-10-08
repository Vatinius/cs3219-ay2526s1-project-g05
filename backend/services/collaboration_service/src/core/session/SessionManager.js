import { randomUUID } from "crypto";
import { CollaborationSession } from "./CollaborationSession.js";

export class SessionManager {
  constructor({ maxParticipants, sessionTimeoutMs, broadcaster }) {
    this.sessions = new Map();
    this.maxParticipants = maxParticipants;
    this.sessionTimeoutMs = sessionTimeoutMs;
    this.broadcaster = broadcaster;
  }

  createSession({ sessionId, question } = {}) {
    const id = sessionId ?? randomUUID();

    if (this.sessions.has(id)) {
      throw new Error("Session with the same id already exists");
    }

    const session = new CollaborationSession({
      id,
      question: question ?? null,
      maxParticipants: this.maxParticipants,
      sessionTimeoutMs: this.sessionTimeoutMs,
      broadcaster: this.broadcaster,
    });

    this.sessions.set(id, session);
    return session;
  }

  getSession(sessionId) {
    return this.sessions.get(sessionId);
  }

  closeSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    for (const participant of session.participants.values()) {
      if (participant.connection) {
        try {
          participant.connection.close();
        } catch (error) {
          // ignore closure errors
        }
      }
    }

    this.sessions.delete(sessionId);
  }

  registerParticipant({ sessionId, userId, username, connection }) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    const participant = session.addParticipant({ userId, username, connection });

    return {
      session,
      participant,
    };
  }

  removeParticipant({ sessionId, userId }) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    session.removeParticipant(userId);

    if (session.participants.size === 0) {
      this.sessions.delete(sessionId);
    }
  }

  handleDisconnect({ sessionId, userId }) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    session.handleDisconnect(userId);
  }

  handleReconnect({ sessionId, userId, connection }) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error("Session does not exist");
    }

    session.handleReconnect(userId, connection);
  }

  listSessions() {
    return Array.from(this.sessions.values()).map((session) => session.toSummary());
  }
}
