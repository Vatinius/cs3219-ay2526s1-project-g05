import { Participant } from "./Participant.js";
import { OperationTransformer } from "../operations/OperationTransformer.js";

const INITIAL_DOCUMENT = "";

export class CollaborationSession {
  constructor({ id, maxParticipants, question, sessionTimeoutMs, broadcaster }) {
    this.id = id;
    this.maxParticipants = maxParticipants;
    this.participants = new Map();
    this.document = INITIAL_DOCUMENT;
    this.operations = [];
    this.question = question ?? null;
    this.pendingQuestionChange = null;
    this.pendingSessionClosure = new Set();
    this.reconnectionTimers = new Map();
    this.sessionTimeoutMs = sessionTimeoutMs;
    this.transformer = new OperationTransformer();
    this.broadcaster = broadcaster;
  }

  toSummary() {
    return {
      id: this.id,
      question: this.question,
      participants: Array.from(this.participants.values()).map((participant) => ({
        userId: participant.userId,
        username: participant.username,
        connected: participant.isConnected(),
      })),
      document: this.document,
      version: this.operations.length,
    };
  }

  hasCapacity() {
    return this.participants.size < this.maxParticipants;
  }

  addParticipant({ userId, username, connection }) {
    if (!this.hasCapacity() && !this.participants.has(userId)) {
      throw new Error("Session is full");
    }

    let participant = this.participants.get(userId);

    if (!participant) {
      participant = new Participant({ userId, username });
      this.participants.set(userId, participant);
    }

    if (connection) {
      participant.attachConnection(connection);
      this.#clearReconnectionTimer(userId);
    }

    return participant;
  }

  removeParticipant(userId) {
    this.participants.delete(userId);
  }

  handleDisconnect(userId) {
    const participant = this.participants.get(userId);
    if (!participant) {
      return;
    }

    participant.detachConnection();
    this.#scheduleReconnectionTimer(userId);
  }

  handleReconnect(userId, connection) {
    const participant = this.participants.get(userId);
    if (!participant) {
      throw new Error("Participant does not exist in this session");
    }

    participant.attachConnection(connection);
    this.#clearReconnectionTimer(userId);
    this.broadcaster.broadcastToOthers(this, userId, {
      type: "PARTNER_RECONNECTED",
      payload: { userId },
    });
  }

  applyOperation({ userId, operation }) {
    const baseVersion = operation.baseVersion ?? 0;
    const transformed = this.transformer.transform(operation, this.operations, baseVersion);
    const conflictDetected = this.#hasConflict(operation, transformed);

    const appliedOperation = {
      ...transformed,
      userId,
      version: this.operations.length + 1,
    };

    this.document = this.#applyToDocument(this.document, appliedOperation);
    this.operations.push(appliedOperation);

    const response = {
      type: "OPERATION_APPLIED",
      payload: {
        userId,
        operation: appliedOperation,
        document: this.document,
      },
    };

    this.broadcaster.broadcast(this, response);

    if (conflictDetected) {
      this.broadcaster.broadcast(this, {
        type: "OPERATION_CONFLICT",
        payload: {
          userId,
          operation: appliedOperation,
        },
      });
    }

    return appliedOperation;
  }

  requestQuestionChange(userId, proposedQuestion) {
    if (!proposedQuestion || !proposedQuestion.id) {
      throw new Error("Question proposal must contain an id");
    }

    if (this.pendingQuestionChange && this.pendingQuestionChange.question.id !== proposedQuestion.id) {
      this.pendingQuestionChange = null;
    }

    if (!this.pendingQuestionChange) {
      this.pendingQuestionChange = {
        question: proposedQuestion,
        approvals: new Set([userId]),
      };

      this.broadcaster.broadcastToOthers(this, userId, {
        type: "QUESTION_CHANGE_PROPOSED",
        payload: {
          question: proposedQuestion,
          proposedBy: userId,
        },
      });

      return { status: "pending" };
    }

    this.pendingQuestionChange.approvals.add(userId);

    if (this.pendingQuestionChange.approvals.size >= Math.min(this.participants.size, this.maxParticipants)) {
      this.question = this.pendingQuestionChange.question;
      this.pendingQuestionChange = null;
      this.broadcaster.broadcast(this, {
        type: "QUESTION_CHANGED",
        payload: { question: this.question },
      });
      return { status: "accepted", question: this.question };
    }

    return { status: "pending" };
  }

  rejectQuestionChange(userId) {
    if (!this.pendingQuestionChange) {
      return { status: "idle" };
    }

    const rejectedQuestion = this.pendingQuestionChange.question;
    this.pendingQuestionChange = null;
    this.broadcaster.broadcast(this, {
      type: "QUESTION_CHANGE_REJECTED",
      payload: {
        rejectedBy: userId,
        question: rejectedQuestion,
      },
    });
    return { status: "rejected" };
  }

  requestSessionEnd(userId) {
    this.pendingSessionClosure.add(userId);

    if (this.pendingSessionClosure.size >= this.participants.size) {
      this.broadcaster.broadcast(this, {
        type: "SESSION_ENDED",
        payload: { reason: "mutual" },
      });
      return { status: "ended" };
    }

    this.broadcaster.broadcastToOthers(this, userId, {
      type: "PARTNER_END_SESSION_REQUESTED",
      payload: { userId },
    });

    return { status: "pending" };
  }

  cancelSessionEndRequest(userId) {
    this.pendingSessionClosure.delete(userId);
  }

  notifyPartnerDisconnected(disconnectedUserId) {
    this.broadcaster.broadcastToOthers(this, disconnectedUserId, {
      type: "PARTNER_DISCONNECTED",
      payload: {
        userId: disconnectedUserId,
        timeoutMs: this.sessionTimeoutMs,
      },
    });
  }

  #applyToDocument(document, operation) {
    if (operation.type === "insert") {
      const prefix = document.slice(0, operation.index);
      const suffix = document.slice(operation.index);
      return `${prefix}${operation.text}${suffix}`;
    }

    if (operation.type === "delete") {
      const prefix = document.slice(0, operation.index);
      const suffix = document.slice(operation.index + operation.length);
      return `${prefix}${suffix}`;
    }

    throw new Error(`Unsupported operation type: ${operation.type}`);
  }

  #hasConflict(originalOperation, transformedOperation) {
    if (!originalOperation || !transformedOperation) {
      return false;
    }

    if (originalOperation.index !== transformedOperation.index) {
      return true;
    }

    if (originalOperation.type !== transformedOperation.type) {
      return true;
    }

    if (originalOperation.type === "delete" && originalOperation.length !== transformedOperation.length) {
      return true;
    }

    return false;
  }

  #scheduleReconnectionTimer(userId) {
    this.notifyPartnerDisconnected(userId);
    const timer = setTimeout(() => {
      this.pendingSessionClosure = new Set();
      this.broadcaster.broadcast(this, {
        type: "SESSION_ENDED",
        payload: { reason: "timeout", userId },
      });
      this.broadcaster.closeSession(this.id);
    }, this.sessionTimeoutMs);

    this.reconnectionTimers.set(userId, timer);
  }

  #clearReconnectionTimer(userId) {
    const timer = this.reconnectionTimers.get(userId);
    if (timer) {
      clearTimeout(timer);
      this.reconnectionTimers.delete(userId);
    }
  }
}
