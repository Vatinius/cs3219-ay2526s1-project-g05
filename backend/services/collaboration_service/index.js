import { createServer } from "http";
import { Server } from "socket.io";
import config from "./src/config.js";
import createApp from "./src/app.js";
import { sessionStore } from "./src/store/sessionStore.js";
import { registerCollaborationHandlers } from "./src/socketHandlers.js";

const app = createApp({
  sessionStore,
  corsOrigins: config.corsOrigins,
});

const server = createServer(app);

const io = new Server(server, {
  cors: {
    origin: config.corsOrigins,
    credentials: true,
  },
});

app.set("io", io);

registerCollaborationHandlers(io, { store: sessionStore });

server.listen(config.port, () => {
  console.log(`Collaboration service is running on port ${config.port}`);
});
