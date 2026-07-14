import app from "./app";
import { logger } from "./lib/logger";
import { bot } from "./lib/bot";
import { startAlertChecker } from "./lib/alertChecker";
import { startCleanupJob } from "./lib/cleanupJob";
import { startPriceHistoryCollector } from "./lib/priceHistoryCollector";
import http from "http";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  startAlertChecker(bot);
  startCleanupJob();
  startPriceHistoryCollector();

  // Keep-alive: ping the healthz endpoint every 4 minutes so
  // Replit's proxy doesn't mark the container as idle and sleep it.
  setInterval(() => {
    const req = http.get(`http://localhost:${port}/api/healthz`, (res) => {
      res.resume();
    });
    req.on("error", (e) => logger.warn({ e }, "Keep-alive ping failed"));
  }, 4 * 60 * 1000);
});
