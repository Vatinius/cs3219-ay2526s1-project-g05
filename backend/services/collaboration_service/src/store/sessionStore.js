const DEFAULT_CODE = "";

const createSessionRecord = ({
  sessionId,
  initialCode = DEFAULT_CODE,
  question = null,
}) => {
  const now = new Date().toISOString();

  return {
    id: sessionId,
    code: initialCode,
    version: 0,
    question,
    participants: new Map(),
    createdAt: now,
    updatedAt: now,
    lastChange: null,
  };
};

const cloneParticipant = (participant) => ({
  userId: participant.userId,
  displayName: participant.displayName,
  connected: participant.connected,
  cursor: participant.cursor,
  joinedAt: participant.joinedAt,
  lastSeenAt: participant.lastSeenAt,
});

const snapshotSession = (session) => ({
  id: session.id,
  code: session.code,
  version: session.version,
  question: session.question,
  participants: Array.from(session.participants.values()).map((participant) =>
    cloneParticipant(participant)
  ),
  createdAt: session.createdAt,
  updatedAt: session.updatedAt,
  lastChange: session.lastChange,
});

export class SessionStore {
  constructor() {
    this.sessions = new Map();
  }

  ensureSession(sessionId, { initialCode, question } = {}) {
    if (!sessionId) {
      throw new Error("A session identifier is required");
    }

    const existing = this.sessions.get(sessionId);

    if (existing) {
      return { session: existing, created: false };
    }

    const session = createSessionRecord({
      sessionId,
      initialCode,
      question: question
        ? { ...question, updatedAt: new Date().toISOString() }
        : null,
    });

    this.sessions.set(sessionId, session);

    return { session, created: true };
  }

  getSession(sessionId) {
    return this.sessions.get(sessionId) ?? null;
  }

  getSessionSnapshot(sessionId) {
    const session = this.getSession(sessionId);

    if (!session) {
      return null;
    }

    return snapshotSession(session);
  }

  addOrUpdateParticipant(sessionId, { userId, displayName, socketId }) {
    if (!userId) {
      throw new Error("A user identifier is required to join a session");
    }

    const { session } = this.ensureSession(sessionId);
    const existing = session.participants.get(userId);
    const now = new Date().toISOString();

    const participantRecord = {
      userId,
      displayName: displayName ?? existing?.displayName ?? null,
      connected: true,
      cursor: existing?.cursor ?? null,
      joinedAt: existing?.joinedAt ?? now,
      lastSeenAt: now,
      socketId,
    };

    session.participants.set(userId, participantRecord);
    session.updatedAt = now;

    return {
      participant: cloneParticipant(participantRecord),
      isNewParticipant: !existing,
      session,
    };
  }

  markParticipantDisconnected(sessionId, userId) {
    const session = this.getSession(sessionId);

    if (!session) {
      return null;
    }

    const participant = session.participants.get(userId);

    if (!participant) {
      return null;
    }

    participant.connected = false;
    participant.socketId = null;
    participant.lastSeenAt = new Date().toISOString();
    session.updatedAt = participant.lastSeenAt;

    return cloneParticipant(participant);
  }

  removeParticipant(sessionId, userId) {
    const session = this.getSession(sessionId);

    if (!session) {
      return false;
    }

    const removed = session.participants.delete(userId);

    if (removed) {
      session.updatedAt = new Date().toISOString();
    }

    return removed;
  }

  updateParticipantCursor(sessionId, userId, cursor) {
    const session = this.getSession(sessionId);

    if (!session) {
      return null;
    }

    const participant = session.participants.get(userId);

    if (!participant) {
      return null;
    }

    participant.cursor = cursor;
    participant.lastSeenAt = new Date().toISOString();
    session.updatedAt = participant.lastSeenAt;

    return cloneParticipant(participant);
  }

  applyCodeUpdate(sessionId, { userId, fullText, clientVersion, changeId }) {
    const { session } = this.ensureSession(sessionId);
    const now = new Date().toISOString();
    const previousVersion = session.version;
    const conflict = clientVersion != null && clientVersion !== previousVersion;

    session.code = fullText;
    session.version = previousVersion + 1;
    session.updatedAt = now;
    session.lastChange = {
      changeId: changeId ?? null,
      userId: userId ?? null,
      appliedAt: now,
      previousVersion,
      version: session.version,
      conflict,
    };

    return {
      session,
      conflict,
      version: session.version,
      lastChange: session.lastChange,
    };
  }

  setQuestion(sessionId, question, { userId } = {}) {
    const { session } = this.ensureSession(sessionId);
    const now = new Date().toISOString();

    session.question = {
      ...question,
      updatedAt: now,
      updatedBy: userId ?? null,
    };
    session.updatedAt = now;

    return snapshotSession(session);
  }
}

export const sessionStore = new SessionStore();

export default sessionStore;
