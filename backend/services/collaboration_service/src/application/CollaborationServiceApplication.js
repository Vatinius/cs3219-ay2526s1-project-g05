import express from "express";
import http from "http";

export class CollaborationServiceApplication {
  constructor({ port, roomController, websocketGateway }) {
    this.port = port;
    this.roomController = roomController;
    this.websocketGateway = websocketGateway;
    this.app = express();
    this.server = http.createServer(this.app);
  }

  configureMiddleware() {
    this.app.use(express.json());
  }

  configureRoutes() {
    this.roomController.registerRoutes(this.app);
  }

  start() {
    this.configureMiddleware();
    this.configureRoutes();
    this.websocketGateway.attachToServer(this.server);

    this.server.listen(this.port, () => {
      console.log(`Collaboration service is running on port ${this.port}`);
    });
  }
}
