import app from "./app";
import { logger } from "./lib/logger";
import { bot } from "./lib/bot";
import { startAlertChecker } from "./lib/alertChecker";
import { startCleanupJob } from "./lib/cleanupJob";
import { startPriceHistoryCollector } from "./lib/priceHistoryCollector";
import { startDailyReportJob } from "./lib/dailyReportJob";

const rawPort = process.env.PORT ?? "8080";
const port = Number(rawPort);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = app.listen(port, "0.0.0.0", () => {
  logger.info({ port }, "Server listening");
  startAlertChecker(bot);
  startCleanupJob();
  startPriceHistoryCollector();
  startDailyReportJob(bot);
});

server.on("error", (err) => {
  logger.error({ err }, "Error listening on port");
  process.exitCode = 1;
});
