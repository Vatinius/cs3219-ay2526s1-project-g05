import { appConfig } from "./src/config/environment.js";
import { CollaborationServiceApplication } from "./src/application/CollaborationServiceApplication.js";
import { SessionManager } from "./src/core/session/SessionManager.js";
import { WebSocketBroadcaster } from "./src/infrastructure/websocket/WebSocketBroadcaster.js";
import { WebSocketGateway } from "./src/infrastructure/websocket/WebSocketGateway.js";
import { RoomController } from "./src/controllers/RoomController.js";

const broadcaster = new WebSocketBroadcaster({ sessionManager: null });
const sessionManager = new SessionManager({
  maxParticipants: appConfig.maxParticipants,
  sessionTimeoutMs: appConfig.sessionTimeoutMs,
  broadcaster,
});

broadcaster.sessionManager = sessionManager;

const roomController = new RoomController({ sessionManager });
const websocketGateway = new WebSocketGateway({ sessionManager });

const application = new CollaborationServiceApplication({
  port: appConfig.port,
  roomController,
  websocketGateway,
});

application.start();
