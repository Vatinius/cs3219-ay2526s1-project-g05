export class Participant {
  constructor({ userId, username }) {
    this.userId = userId;
    this.username = username;
    this.connection = null;
    this.lastSeen = new Date();
  }

  attachConnection(connection) {
    this.connection = connection;
    this.touch();
  }

  detachConnection() {
    this.connection = null;
    this.touch();
  }

  isConnected() {
    return Boolean(this.connection);
  }

  touch() {
    this.lastSeen = new Date();
  }
}
