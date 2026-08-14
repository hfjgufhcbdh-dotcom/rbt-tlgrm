import cron from "node-cron";
import type TelegramBot from "node-telegram-bot-api";
import { and, desc, eq, lt } from "drizzle-orm";
import { db } from "@workspace/db";
import { priceHistoryTable, usersTable } from "@workspace/db/schema";
import {
  fetchCoinGeckoPrices,
  fetchLivePrices,
  fetchRawPrices,
  type GlobalCryptoPrices,
} from "./prices";
import { logger } from "./logger";
import { generateChangeChartBuffer, generateChartBuffer } from "./chart";
import {
  deleteTrackedMessages,
  sendMessageAndSave,
  sendPhotoAndSave,
} from "./messageTracker";
import {
  DEFAULT_USER_COIN_IDS,
  ensureDefaultUserCoins,
  getUserCoinIdsForChats,
} from "./userCoins";

type ReportAsset = "gold" | "btc" | "eth" | "ton";

const REPORT_ASSETS: Array<{ asset: ReportAsset; label: string }> = [
  { asset: "gold", label: "طلای ۲۴ عیار" },
  { asset: "btc", label: "بیت‌کوین" },
  { asset: "eth", label: "اتریوم" },
  { asset: "ton", label: "تون‌کوین" },
];

type GlobalReportItem = {
  name: string;
  price: number;
  change: number;
};

type DailyReportData = {
  text: string;
  globalItems: GlobalReportItem[];
};

const COIN_LABELS: Record<string, string> = {
  rabbitcoin: "RabBitcoin (RBTC)",
  memefi: "MemeFi (MEMEFI)",
  bitcoin: "بیت‌کوین (BTC)",
  ethereum: "اتریوم (ETH)",
  solana: "سولانا (SOL)",
  "the-open-network": "تون‌کوین (TON)",
  tether: "تتر (USDT)",
};

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

function buildGlobalReportItems(
  prices: GlobalCryptoPrices,
  coinIds: string[],
): GlobalReportItem[] {
  return coinIds.flatMap((id) => {
    const item = prices[id];
    if (
      !item ||
      !Number.isFinite(item.usd) ||
      item.usd_24h_change === null ||
      !Number.isFinite(item.usd_24h_change)
    ) {
      return [];
    }

    return [{
      name: COIN_LABELS[id] ?? id.toUpperCase(),
      price: item.usd,
      change: item.usd_24h_change,
    }];
  });
}

function formatUsdPrice(price: number): string {
  return price >= 1
    ? price.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 2,
      })
    : `$${price.toFixed(6)}`;
}

function formatGlobalReport(items: GlobalReportItem[]): string {
  return items.map((item) => {
    const icon = item.change > 0 ? "🟢" : item.change < 0 ? "🔴" : "⚪";
    const sign = item.change > 0 ? "+" : "";
    return (
      `🔹 *${item.name}*\n` +
      `   قیمت: ${formatUsdPrice(item.price)}\n` +
      `   تغییر ۲۴ ساعته: ${icon} ${sign}${item.change.toFixed(2)}٪`
    );
  }).join("\n\n");
}

async function buildDailyReportBase(): Promise<string> {
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

function buildDailyReport(
  baseText: string,
  globalPrices: GlobalCryptoPrices,
  coinIds: string[],
): DailyReportData {
  const globalItems = buildGlobalReportItems(globalPrices, coinIds);
  const globalSection = globalItems.length > 0
    ? `\n\n🌐 *بازار جهانی و کریپتو*\n\n${formatGlobalReport(globalItems)}`
    : "\n\n🌐 *بازار جهانی و کریپتو*\n\nاطلاعات معتبر برای ارزهای انتخابی موجود نیست.";

  return {
    text: `${baseText}${globalSection}`,
    globalItems,
  };
}

async function sendDailyReport(bot: TelegramBot): Promise<void> {
  const users = await db.select({ chatId: usersTable.chatId }).from(usersTable);
  const chatIds = users.map(({ chatId }) => chatId);

  await Promise.all(
    chatIds.map((chatId) =>
      ensureDefaultUserCoins(chatId).catch((err) => {
        logger.warn({ err, chatId }, "Failed to initialize user coin list for report");
      }),
    ),
  );

  const userCoinMap = await getUserCoinIdsForChats(chatIds);
  const allCoinIds = [
    ...new Set(
      chatIds.flatMap(
        (chatId) => userCoinMap.get(chatId) ?? [...DEFAULT_USER_COIN_IDS],
      ),
    ),
  ];

  let globalPrices: GlobalCryptoPrices = {};
  try {
    globalPrices = await fetchCoinGeckoPrices(allCoinIds);
  } catch (err) {
    logger.warn({ err }, "Global market data unavailable for daily report");
  }

  const baseReport = await buildDailyReportBase();

  const results = await Promise.allSettled(
    users.map(async ({ chatId }) => {
      const coinIds = userCoinMap.get(chatId) ?? [...DEFAULT_USER_COIN_IDS];
      const reportData = buildDailyReport(baseReport, globalPrices, coinIds);
      let chartBuffer: Buffer | null = null;
      let chartCaption = "📈 نمودار ۷ روزهٔ بیت‌کوین";

      try {
        if (reportData.globalItems.length > 0) {
          chartBuffer = await generateChangeChartBuffer(
            reportData.globalItems.map((item) => ({
              label: item.name.split(" ")[0] ?? item.name,
              change: item.change,
            })),
          );
          chartCaption = "📊 نمودار تغییرات ۲۴ ساعت اخیر ارزهای انتخابی شما";
        } else {
          const chart = await generateChartBuffer("crypto", "btc", "7");
          chartBuffer = chart.buffer;
        }
      } catch (err) {
        logger.warn({ err, chatId }, "Daily report chart unavailable; sending text report");
      }

      await deleteTrackedMessages(bot, chatId);
      if (chartBuffer) {
        return sendPhotoAndSave(bot, chatId, chartBuffer, {
          caption: `${reportData.text}\n\n${chartCaption}`,
          parse_mode: "Markdown",
        });
      }
      return sendMessageAndSave(bot, chatId, reportData.text, { parse_mode: "Markdown" });
    }),
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