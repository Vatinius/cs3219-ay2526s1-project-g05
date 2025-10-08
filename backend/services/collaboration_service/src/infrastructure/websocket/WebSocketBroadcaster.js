export class WebSocketBroadcaster {
  constructor({ sessionManager }) {
    this.sessionManager = sessionManager;
  }

  broadcast(session, message) {
    for (const participant of session.participants.values()) {
      this.#send(participant.connection, message);
    }
  }

  broadcastToOthers(session, excludedUserId, message) {
    for (const participant of session.participants.values()) {
      if (participant.userId === excludedUserId) {
        continue;
      }
      this.#send(participant.connection, message);
    }
  }

  closeSession(sessionId) {
    this.sessionManager.closeSession(sessionId);
  }

  #send(connection, message) {
    if (!connection || connection.readyState !== 1) {
      return;
    }

    try {
      connection.send(JSON.stringify(message));
    } catch (error) {
      // ignore sending errors to keep the session alive for other participants
    }
  }
}
