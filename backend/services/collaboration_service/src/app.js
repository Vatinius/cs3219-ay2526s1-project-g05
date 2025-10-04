import cors from "cors";
import express from "express";
import buildSessionRouter from "./routes/sessionRoutes.js";

const createApp = ({ sessionStore, corsOrigins }) => {
  const app = express();

  const corsOptions = {
    origin: corsOrigins && corsOrigins.length > 0 ? corsOrigins : ["*"],
    credentials: true,
  };

  app.use(cors(corsOptions));
  app.use(express.json({ limit: "256kb" }));

  app.get("/status", (req, res) => {
    res.send("Collaboration service is up and running!");
  });

  app.use("/sessions", buildSessionRouter({ sessionStore }));

  app.use((err, req, res, _next) => {
    console.error("Unhandled error in collaboration service", err);
    res.status(err.status ?? 500).json({
      error: err.message ?? "Internal server error",
    });
  });

  return app;
};

export default createApp;
