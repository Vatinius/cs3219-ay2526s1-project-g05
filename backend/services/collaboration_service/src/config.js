import dotenv from "dotenv";

dotenv.config();

const DEFAULT_PORT = 4004;

const parsePort = (rawPort) => {
  if (!rawPort) {
    return DEFAULT_PORT;
  }

  const parsed = Number.parseInt(rawPort, 10);

  if (Number.isNaN(parsed) || parsed <= 0) {
    return DEFAULT_PORT;
  }

  return parsed;
};

const parseCorsOrigins = (rawOrigins) => {
  if (!rawOrigins || rawOrigins.trim() === "") {
    return ["*"];
  }

  return rawOrigins
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
};

export const config = {
  port: parsePort(
    process.env.COLLABORATION_SERVICE_PORT ||
      process.env.COLLABORATIONSERVICEPORT ||
      process.env.PORT
  ),
  corsOrigins: parseCorsOrigins(process.env.COLLABORATION_CORS_ORIGIN || ""),
};

export default config;
