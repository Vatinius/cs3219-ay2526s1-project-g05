import http from "http";
import express from "express";
import { Server as SocketIOServer } from "socket.io";
import { MongoClientInstance } from "../../../common_scripts/mongo.js";
import { startSwaggerDocs } from "../../../common_scripts/swagger_docs.js";
import { CollaborationSessionRepository } from "./repositories/CollaborationSessionRepository.js";
import { CollaborationSessionService } from "./services/CollaborationSessionService.js";
import {
  CollaborationController,
  errorMiddleware,
} from "./controllers/CollaborationController.js";
import { createCollaborationRouter } from "./routes/collaborationRoutes.js";
import { CollaborationSocketManager } from "./websocket/CollaborationSocketManager.js";

export class CollaborationApplication {
  constructor({ port = process.env.COLLABORATIONSERVICEPORT || 4004 } = {}) {
    this.port = port;
    this.app = null;
    this.server = null;
    this.socketManager = null;
  }

  async init() {
    if (this.app) {
      return this.app;
    }

    await MongoClientInstance.start();
    const repository = await CollaborationSessionRepository.initialize(MongoClientInstance.db);
    const collaborationService = new CollaborationSessionService({ repository });
    const controller = new CollaborationController(collaborationService);
    const socketManager = new CollaborationSocketManager({ collaborationService });

    const app = express();
    app.enable("trust proxy");
    app.use(express.json());

    startSwaggerDocs(app, "Collaboration Service API", this.port);

    app.get("/status", (_req, res) => {
      res.json({ status: "Collaboration service is running" });
    });

    app.use("/api/collaboration", createCollaborationRouter(controller));
    app.use(errorMiddleware);

    this.app = app;
    this.socketManager = socketManager;
    return app;
  }

  async start() {
    const app = await this.init();

    const server = http.createServer(app);
    const io = new SocketIOServer(server, {
      cors: {
        origin: process.env.COLLABORATION_SOCKET_CORS_ORIGIN || "*",
        methods: ["GET", "POST"],
      },
    });

    this.socketManager.bind(io);

    return new Promise((resolve) => {
      server.listen(this.port, () => {
        console.log(`Collaboration service listening on port ${this.port}`);
        this.server = server;
        this.io = io;
        resolve(server);
      });
    });
  }
}
