import { db } from "@workspace/db";
import { alertsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { fetchLivePrices, type PriceData } from "./prices";
import { logger } from "./logger";
import type TelegramBot from "node-telegram-bot-api";

const ASSET_LABELS: Record<keyof PriceData, string> = {
  gold18: "طلای ۱۸ عیار",
  gold24: "طلای ۲۴ عیار",
  mithqal: "مثقال طلا",
  emamiCoin: "سکه امامی",
  baharCoin: "بهار آزادی",
  halfCoin: "نیم سکه",
  quarterCoin: "ربع سکه",
  usd: "دلار",
  eur: "یورو",
  gbp: "پوند",
  aed: "درهم",
  afn: "افغانی",
  usdt: "تتر",
  ton: "تون",
  hmstr: "همستر",
  dogs: "داگز",
  star: "استار",
  not: "نات‌کوین",
  btc: "بیت‌کوین",
  eth: "اتریوم",
  updatedAt: "updatedAt",
};

function parseToman(formatted: string): number | null {
  const cleaned = formatted.replace(/[^0-9]/g, "");
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? null : num;
}

export function startAlertChecker(bot: TelegramBot) {
  const CHECK_INTERVAL_MS = 2 * 60 * 1000;

  async function checkAlerts() {
    try {
      const activeAlerts = await db
        .select()
        .from(alertsTable)
        .where(eq(alertsTable.active, true));

      if (activeAlerts.length === 0) return;

      const prices = await fetchLivePrices();

      for (const alert of activeAlerts) {
        const asset = alert.asset as keyof PriceData;
        const rawValue = prices[asset];
        if (asset === "updatedAt" || typeof rawValue !== "string") continue;

        const currentPrice = parseToman(rawValue);
        if (currentPrice === null) continue;

        const target = parseFloat(alert.targetPrice);
        const triggered =
          (alert.direction === "above" && currentPrice >= target) ||
          (alert.direction === "below" && currentPrice <= target);

        if (triggered) {
          const label = ASSET_LABELS[asset] ?? asset;
          const dirText = alert.direction === "above" ? "بالاتر از" : "پایین‌تر از";
          const msg =
            `🔔 *هشدار قیمت*\n\n` +
            `📌 ${label} به قیمت \`${currentPrice.toLocaleString("fa-IR")} تومان\` رسید\\!\n` +
            `🎯 هدف شما: ${dirText} \`${target.toLocaleString("fa-IR")} تومان\`\n\n` +
            `این هشدار غیرفعال شد\\.`;

          await bot.sendMessage(alert.chatId, msg, { parse_mode: "MarkdownV2" });

          await db
            .update(alertsTable)
            .set({ active: false, triggeredAt: new Date() })
            .where(eq(alertsTable.id, alert.id));

          logger.info({ alertId: alert.id, asset, currentPrice, target }, "Alert triggered");
        }
      }
    } catch (err) {
      logger.error({ err }, "Error in alert checker");
    }
  }

  setInterval(checkAlerts, CHECK_INTERVAL_MS);
  logger.info({ intervalMs: CHECK_INTERVAL_MS }, "Alert checker started");
}
