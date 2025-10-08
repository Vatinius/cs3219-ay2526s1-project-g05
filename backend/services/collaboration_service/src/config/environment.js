import dotenv from "dotenv";

dotenv.config();

export const appConfig = {
  port: Number(process.env.COLLABORATION_SERVICE_PORT || process.env.COLLABORATIONSERVICEPORT || 4004),
  sessionTimeoutMs: Number(process.env.COLLABORATION_SESSION_TIMEOUT_MS || 5 * 60 * 1000),
  maxParticipants: Number(process.env.COLLABORATION_SESSION_MAX_PARTICIPANTS || 2),
};
