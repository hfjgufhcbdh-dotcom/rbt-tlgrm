import cron from "node-cron";
import type TelegramBot from "node-telegram-bot-api";
import { and, desc, eq, lt } from "drizzle-orm";
import { db } from "@workspace/db";
import { priceHistoryTable, usersTable } from "@workspace/db/schema";
import { fetchLivePrices, fetchRawPrices } from "./prices";
import { logger } from "./logger";

type ReportAsset = "gold" | "btc" | "eth" | "ton";

const REPORT_ASSETS: Array<{ asset: ReportAsset; label: string }> = [
  { asset: "gold", label: "طلای ۲۴ عیار" },
  { asset: "btc", label: "بیت‌کوین" },
  { asset: "eth", label: "اتریوم" },
  { asset: "ton", label: "تون‌کوین" },
];

export function calculateDailyChange(todayPrice: number, yesterdayPrice: number): string {
  if (!Number.isFinite(todayPrice) || !Number.isFinite(yesterdayPrice) || yesterdayPrice <= 0) {
    return "اطلاعات کافی نیست";
  }

  const changePct = ((todayPrice - yesterdayPrice) / yesterdayPrice) * 100;
  if (Math.abs(changePct) < 0.005) {
    return "بدون تغییر (۰٫۰۰٪)";
  }

  const direction = changePct > 0 ? "📈 افزایش" : "📉 کاهش";
  const sign = changePct > 0 ? "+" : "";
  return `${direction} ${sign}${changePct.toFixed(2)}٪`;
}

async function getPreviousPrice(asset: ReportAsset, cutoff: Date): Promise<number | null> {
  const [row] = await db
    .select({ priceToman: priceHistoryTable.priceToman })
    .from(priceHistoryTable)
    .where(
      and(
        eq(priceHistoryTable.asset, asset),
        lt(priceHistoryTable.recordedAt, cutoff),
      ),
    )
    .orderBy(desc(priceHistoryTable.recordedAt))
    .limit(1);

  if (!row) return null;
  const price = Number(row.priceToman);
  return Number.isFinite(price) ? price : null;
}

async function buildDailyReport(): Promise<string> {
  await fetchLivePrices();
  const raw = await fetchRawPrices();
  if (!raw) {
    throw new Error("No current price snapshot is available");
  }

  const currentPrices: Record<ReportAsset, number> = {
    gold: raw.gold24PerGramToman,
    btc: raw.btcUsd * raw.usdToToman,
    eth: raw.ethUsd * raw.usdToToman,
    ton: raw.tonUsd * raw.usdToToman,
  };
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const lines = await Promise.all(
    REPORT_ASSETS.map(async ({ asset, label }) => {
      const current = currentPrices[asset];
      const previous = await getPreviousPrice(asset, cutoff);
      const currentText = Math.round(current).toLocaleString("fa-IR");
      const changeText = previous === null
        ? "اطلاعات روز قبل موجود نیست"
        : calculateDailyChange(current, previous);
      return `• *${label}:* ${currentText} تومان — ${changeText}`;
    }),
  );

  return (
    "📊 *گزارش تغییرات روزانه قیمت*\n\n" +
    "مقایسه با آخرین snapshot حدود ۲۴ ساعت قبل:\n\n" +
    lines.join("\n") +
    "\n\n🕐 زمان گزارش: " +
    new Date().toLocaleString("fa-IR", { timeZone: "Asia/Tehran" })
  );
}

async function sendDailyReport(bot: TelegramBot): Promise<void> {
  const report = await buildDailyReport();
  const users = await db.select({ chatId: usersTable.chatId }).from(usersTable);

  const results = await Promise.allSettled(
    users.map(({ chatId }) =>
      bot.sendMessage(chatId, report, { parse_mode: "Markdown" }),
    ),
  );
  const failed = results.filter((result) => result.status === "rejected").length;

  logger.info(
    { recipients: users.length, sent: users.length - failed, failed },
    "Daily price report sent",
  );
}

export function startDailyReportJob(bot: TelegramBot): void {
  cron.schedule(
    "59 23 * * *",
    () => {
      void sendDailyReport(bot).catch((err) => {
        logger.error({ err }, "Daily price report failed");
      });
    },
    { timezone: "Asia/Tehran" },
  );

  logger.info(
    { schedule: "59 23 * * *", timezone: "Asia/Tehran" },
    "Daily price report job started",
  );
}