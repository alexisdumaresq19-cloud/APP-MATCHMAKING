import pino, { type Logger } from "pino";

const level = process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "test" ? "silent" : "info");
const usePretty = process.env.NODE_ENV === "development" && process.env.NEXT_RUNTIME !== "edge";

export const logger: Logger = pino({
  level,
  base: { app: "matchmaking-events" },
  redact: {
    paths: [
      "password",
      "passwordHash",
      "token",
      "secret",
      "*.password",
      "*.passwordHash",
      "*.token",
      "*.secret",
      "headers.authorization",
      "headers.cookie",
    ],
    censor: "[redacted]",
  },
  ...(usePretty
    ? {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "HH:MM:ss" },
        },
      }
    : {}),
});
