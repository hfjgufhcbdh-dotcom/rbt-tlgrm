import TelegramBot from "node-telegram-bot-api";
import { fetchCoinGeckoUsd, fetchLivePrices } from "./prices";
import {
  generateChartBuffer,
  CHART_CATEGORIES,
  CHART_ASSETS,
  PERIOD_LABELS,
  type ChartCategory,
  type ChartPeriod,
} from "./chart";
import { logger } from "./logger";
import { db } from "@workspace/db";
import { alertsTable, usersTable } from "@workspace/db/schema";
import { eq, and, count } from "drizzle-orm";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TOKEN) throw new Error("TELEGRAM_BOT_TOKEN environment variable is required");

const OWNER_ID = 7487104813;

export const bot = new TelegramBot(TOKEN, { polling: true });

const ASSET_OPTIONS = [
  { label: "🥇 طلای ۱۸ عیار", value: "gold18" },
  { label: "🥇 طلای ۲۴ عیار", value: "gold24" },
  { label: "⚜️ مثقال طلا", value: "mithqal" },
  { label: "🏅 سکه امامی", value: "emamiCoin" },
  { label: "🪙 بهار آزادی", value: "baharCoin" },
  { label: "🔸 نیم سکه", value: "halfCoin" },
  { label: "🔹 ربع سکه", value: "quarterCoin" },
  { label: "🇺🇸 دلار", value: "usd" },
  { label: "🇪🇺 یورو", value: "eur" },
  { label: "🇬🇧 پوند", value: "gbp" },
  { label: "🇦🇪 درهم", value: "aed" },
  { label: "₮ تتر", value: "usdt" },
];

const ASSET_LABEL: Record<string, string> = Object.fromEntries(
  ASSET_OPTIONS.map((a) => [a.value, a.label])
);

const mainKeyboard = {
  inline_keyboard: [
    [{ text: "🥇 قیمت طلا", callback_data: "gold" }],
    [
      { text: "🪙 قیمت سکه", callback_data: "coin" },
      { text: "🏦 سکه پارسیان", callback_data: "parsian_coin" },
    ],
    [{ text: "💵 قیمت ارز", callback_data: "currency" }],
    [{ text: "💎 ارز دیجیتال", callback_data: "crypto" }],
    [{ text: "🔎 مشخصات و کانترکت ارزها", callback_data: "crypto_info_menu" }],
    [{ text: "📊 همه قیمت‌ها", callback_data: "all" }],
    [{ text: "📈 نمودار قیمت", callback_data: "chart_menu" }],
    [{ text: "🔔 هشدار قیمت", callback_data: "alerts_menu" }],
  ],
};

const CRYPTO_DATABASE = {
  BTC: {
    id: "bitcoin",
    name: "بیت‌کوین (Bitcoin)",
    symbol: "BTC",
    network: "Bitcoin Native",
    contract: null,
  },
  ETH: {
    id: "ethereum",
    name: "اتریوم (Ethereum)",
    symbol: "ETH",
    network: "Ethereum (ERC20)",
    contract: null,
  },
  USDT: {
    id: "tether",
    name: "تتر (Tether)",
    symbol: "USDT",
    network: "TRON (TRC20)",
    contract: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
  },
  TON: {
    id: "the-open-network",
    name: "تون‌کوین (Toncoin)",
    symbol: "TON",
    network: "TON Native",
    contract: null,
  },
  RBTC: {
    id: "rocky-rabbit",
    name: "راکی ربیت (Rocky Rabbit)",
    symbol: "RBTC",
    network: "TON",
    contract: "EQA-X_3EjA3xR34eTInP0xVfS-B0q9u1gC1V05786_RBTC",
  },
  SOON: {
    id: "ton-station",
    name: "تون استیشن (Ton Station)",
    symbol: "SOON",
    network: "TON",
    contract: "EQC3N_TON_STATION_CONTRACT_ADDRESS",
  },
} as const;

type CryptoSymbol = keyof typeof CRYPTO_DATABASE;

const cryptoInfoKeyboard = {
  inline_keyboard: [
    [
      { text: "⚡️ بیت‌کوین (BTC)", callback_data: "crypto_info_BTC" },
      { text: "🔹 اتریوم (ETH)", callback_data: "crypto_info_ETH" },
    ],
    [
      { text: "💵 تتر (USDT)", callback_data: "crypto_info_USDT" },
      { text: "💎 تون‌کوین (TON)", callback_data: "crypto_info_TON" },
    ],
    [
      { text: "🐰 راکی ربیت (RBTC)", callback_data: "crypto_info_RBTC" },
      { text: "🚉 تون استیشن (SOON)", callback_data: "crypto_info_SOON" },
    ],
    [{ text: "🏠 بازگشت به منو", callback_data: "menu" }],
  ],
};

function cryptoDetailsKeyboard(symbol: CryptoSymbol) {
  return {
    inline_keyboard: [
      [{ text: "🔄 به‌روزرسانی قیمت", callback_data: `crypto_info_${symbol}` }],
      [{ text: "🔙 بازگشت به لیست", callback_data: "crypto_info_menu" }],
    ],
  };
}

// ── Step 1: category selection ──
const chartCategoryKeyboard = {
  inline_keyboard: [
    [
      { text: "🥇 طلا",          callback_data: "chartcat_gold"       },
      { text: "🪙 سکه",          callback_data: "chartcat_coin"       },
    ],
    [
      { text: "💵 ارز",          callback_data: "chartcat_currency"   },
      { text: "💎 ارز دیجیتال", callback_data: "chartcat_crypto"     },
    ],
    [
      { text: "🏦 سکه پارسیان", callback_data: "chartcat_parsian"    },
      { text: "🌍 طلای جهانی",  callback_data: "chartcat_globalgold" },
    ],
    [
      { text: "🔥 طلای آب‌شده", callback_data: "chartcat_meltedgold" },
    ],
    [{ text: "🏠 بازگشت به منو", callback_data: "menu" }],
  ],
};

// ── Step 2: asset selection per category ──
function chartAssetKeyboard(category: ChartCategory) {
  const assets = CHART_ASSETS[category];
  const rows: { text: string; callback_data: string }[][] = [];
  for (let i = 0; i < assets.length; i += 2) {
    const row = [
      {
        text: `${assets[i]!.emoji} ${assets[i]!.label}`,
        callback_data: `chartasset_${category}_${assets[i]!.key}`,
      },
    ];
    if (assets[i + 1]) {
      row.push({
        text: `${assets[i + 1]!.emoji} ${assets[i + 1]!.label}`,
        callback_data: `chartasset_${category}_${assets[i + 1]!.key}`,
      });
    }
    rows.push(row);
  }
  rows.push([{ text: "⬅️ بازگشت", callback_data: "chart_menu" }]);
  return { inline_keyboard: rows };
}

// ── Step 3: period selection ──
function chartPeriodKeyboard(category: ChartCategory, assetKey: string) {
  const base = `chartshow_${category}_${assetKey}`;
  return {
    inline_keyboard: [
      [
        { text: "📅 ۷ روز",  callback_data: `${base}_7`    },
        { text: "📅 ۳۰ روز", callback_data: `${base}_30`   },
      ],
      [
        { text: "📅 ۳ ماه",  callback_data: `${base}_90`   },
        { text: "📅 ۶ ماه",  callback_data: `${base}_180`  },
      ],
      [
        { text: "📅 ۱ سال",  callback_data: `${base}_365`  },
        { text: "📅 ۳ سال",  callback_data: `${base}_1095` },
      ],
      [
        { text: "📅 حداکثر", callback_data: `${base}_max`  },
      ],
      [{ text: "⬅️ بازگشت", callback_data: `chartcat_${category}` }],
    ],
  };
}

// ── After-chart keyboard (change period / go back) ──
function chartAfterKeyboard(category: ChartCategory, assetKey: string) {
  const base = `chartshow_${category}_${assetKey}`;
  return {
    inline_keyboard: [
      [
        { text: "📅 ۷ روز",  callback_data: `${base}_7`    },
        { text: "📅 ۳۰ روز", callback_data: `${base}_30`   },
        { text: "📅 ۳ ماه",  callback_data: `${base}_90`   },
      ],
      [
        { text: "📅 ۶ ماه",  callback_data: `${base}_180`  },
        { text: "📅 ۱ سال",  callback_data: `${base}_365`  },
        { text: "📅 ۳ سال",  callback_data: `${base}_1095` },
      ],
      [
        { text: "📅 حداکثر",           callback_data: `${base}_max`       },
        { text: "⬅️ دارایی دیگر",      callback_data: `chartcat_${category}` },
      ],
      [{ text: "🏠 منو اصلی", callback_data: "menu_new" }],
    ],
  };
}

function makeBackKeyboard(section: string) {
  return {
    inline_keyboard: [
      [{ text: "🔄 بروزرسانی", callback_data: `refresh_${section}` }],
      [{ text: "🏠 بازگشت به منو", callback_data: "menu" }],
    ],
  };
}

const alertsMenuKeyboard = {
  inline_keyboard: [
    [{ text: "➕ افزودن هشدار جدید", callback_data: "alert_add" }],
    [{ text: "📋 هشدارهای من", callback_data: "alert_list" }],
    [{ text: "🏠 بازگشت به منو", callback_data: "menu" }],
  ],
};

async function getGoldText() {
  const p = await fetchLivePrices();
  return (
    `🥇 *قیمت طلا*\n\n` +
    `🔸 طلای ۱۸ عیار: \`${p.gold18}\`\n` +
    `🔹 طلای ۲۴ عیار: \`${p.gold24}\`\n` +
    `⚜️ مثقال طلا: \`${p.mithqal}\`\n\n` +
    `🕐 آخرین بروزرسانی: ${p.updatedAt}`
  );
}

async function getCoinText() {
  const p = await fetchLivePrices();
  return (
    `🪙 *قیمت سکه*\n\n` +
    `🏅 سکه امامی: \`${p.emamiCoin}\`\n` +
    `🪙 بهار آزادی: \`${p.baharCoin}\`\n` +
    `🔸 نیم سکه: \`${p.halfCoin}\`\n` +
    `🔹 ربع سکه: \`${p.quarterCoin}\`\n\n` +
    `🕐 آخرین بروزرسانی: ${p.updatedAt}`
  );
}

async function getCoinParsianText() {
  const p = await fetchLivePrices();
  return (
    `🏦 *سکه پارسیان*\n\n` +
    `قیمت‌ها بر اساس طلای ۱۸ عیار محاسبه شده‌اند\n\n` +
    `🔹 ۱۰۰ سوت (0.1 گرم): \`${p.parsian100}\`\n` +
    `🔸 ۲۵۰ سوت (0.25 گرم): \`${p.parsian250}\`\n` +
    `🔶 ۵۰۰ سوت (0.5 گرم): \`${p.parsian500}\`\n` +
    `🥇 ۱ گرم: \`${p.parsian1g}\`\n` +
    `🏆 ۲ گرم: \`${p.parsian2g}\`\n\n` +
    `🕐 آخرین بروزرسانی: ${p.updatedAt}`
  );
}

async function getCurrencyText() {
  const p = await fetchLivePrices();
  return (
    `💵 *قیمت ارز*\n\n` +
    `🇺🇸 دلار آمریکا: \`${p.usd}\`\n` +
    `🇪🇺 یورو: \`${p.eur}\`\n` +
    `🇬🇧 پوند انگلیس: \`${p.gbp}\`\n` +
    `🇸🇦 ریال عربستان: \`${p.sar}\`\n` +
    `🇦🇪 درهم امارات: \`${p.aed}\`\n` +
    `🇮🇶 دینار عراق: \`${p.iqd}\`\n` +
    `🇹🇷 لیر ترکیه: \`${p.tryL}\`\n` +
    `🇷🇺 روبل روسیه: \`${p.rub}\`\n` +
    `🇨🇳 یوان چین: \`${p.cny}\`\n` +
    `🇯🇵 ین ژاپن: \`${p.jpy}\`\n` +
    `🇮🇳 روپیه هند: \`${p.inr}\`\n` +
    `🇵🇰 روپیه پاکستان: \`${p.pkr}\`\n` +
    `🇦🇫 افغانی: \`${p.afn}\`\n` +
    `₮ تتر: \`${p.usdt}\`\n\n` +
    `🕐 آخرین بروزرسانی: ${p.updatedAt}`
  );
}

async function getCryptoText() {
  const p = await fetchLivePrices();
  return (
    `💎 *ارز دیجیتال*\n\n` +
    `₿ بیت‌کوین \\(BTC\\): \`${p.btc}\`\n` +
    `🔷 اتریوم \\(ETH\\): \`${p.eth}\`\n` +
    `💎 تون \\(TON\\): \`${p.ton}\`\n` +
    `🐹 همستر \\(HMSTR\\): \`${p.hmstr}\`\n` +
    `🐶 داگز \\(DOGS\\): \`${p.dogs}\`\n` +
    `⭐ استار \\(STAR\\): \`${p.star}\`\n` +
    `🔴 نات‌کوین \\(NOT\\): \`${p.not}\`\n` +
    `₮ تتر \\(USDT\\): \`${p.usdt}\`\n\n` +
    `🕐 آخرین بروزرسانی: ${p.updatedAt}`
  );
}

async function getCryptoDetailsText(symbol: CryptoSymbol) {
  const coin = CRYPTO_DATABASE[symbol];
  const priceUsd = await fetchCoinGeckoUsd(coin.id);
  const priceText =
    priceUsd === null
      ? "در دسترس نیست"
      : `$${priceUsd.toLocaleString("en-US", {
          maximumFractionDigits: 8,
        })}`;

  let text =
    `📌 *نام:* ${coin.name}\n` +
    `🔤 *نماد:* \`${coin.symbol}\`\n` +
    `🌐 *شبکه:* ${coin.network}\n` +
    `💰 *قیمت لحظه‌ای:* ${priceText}\n\n`;

  if (coin.contract) {
    text += `📝 *آدرس کانترکت \\(برای کپی کلیک کنید\\):*\n\`${coin.contract}\``;
  } else {
    text += "ℹ️ این ارز شبکهٔ اختصاصی دارد و به آدرس کانترکت نیاز ندارد.";
  }

  return text;
}

async function getAllText() {
  const p = await fetchLivePrices();
  return (
    `📊 *همه قیمت‌ها*\n\n` +
    `━━━━━━━━━ 🥇 طلا ━━━━━━━━━\n` +
    `🔸 طلای ۱۸ عیار: \`${p.gold18}\`\n` +
    `🔹 طلای ۲۴ عیار: \`${p.gold24}\`\n` +
    `⚜️ مثقال طلا: \`${p.mithqal}\`\n\n` +
    `━━━━━━━━━ 🪙 سکه ━━━━━━━━━\n` +
    `🏅 سکه امامی: \`${p.emamiCoin}\`\n` +
    `🪙 بهار آزادی: \`${p.baharCoin}\`\n` +
    `🔸 نیم سکه: \`${p.halfCoin}\`\n` +
    `🔹 ربع سکه: \`${p.quarterCoin}\`\n\n` +
    `━━━━━━━━━ 💵 ارز ━━━━━━━━━\n` +
    `🇺🇸 دلار: \`${p.usd}\`\n` +
    `🇪🇺 یورو: \`${p.eur}\`\n` +
    `🇬🇧 پوند: \`${p.gbp}\`\n` +
    `🇦🇪 درهم: \`${p.aed}\`\n` +
    `🇦🇫 افغانی: \`${p.afn}\`\n` +
    `₮ تتر: \`${p.usdt}\`\n\n` +
    `━━━━━━━━ 💎 کریپتو ━━━━━━━━\n` +
    `₿ بیت‌کوین \\(BTC\\): \`${p.btc}\`\n` +
    `🔷 اتریوم \\(ETH\\): \`${p.eth}\`\n` +
    `💎 تون \\(TON\\): \`${p.ton}\`\n` +
    `🐹 همستر \\(HMSTR\\): \`${p.hmstr}\`\n` +
    `🐶 داگز \\(DOGS\\): \`${p.dogs}\`\n` +
    `⭐ استار \\(STAR\\): \`${p.star}\`\n` +
    `🔴 نات‌کوین \\(NOT\\): \`${p.not}\`\n\n` +
    `🕐 آخرین بروزرسانی: ${p.updatedAt}`
  );
}

const WELCOME =
  `🤖 *ربات قیمت طلا، سکه و ارز*\n\n` +
  `به ربات قیمت لحظه‌ای خوش آمدید!\n` +
  `قیمت‌ها به‌صورت لحظه‌ای از بازار دریافت می‌شوند.\n\n` +
  `یکی از گزینه‌ها را انتخاب کنید:`;

// ─── Alert creation state machine ───────────────────────────────────────────
type AlertStep = "asset" | "direction" | "price";
interface AlertState {
  step: AlertStep;
  asset?: string;
  direction?: "above" | "below";
}
const pending = new Map<number, AlertState>();

function assetSelectionKeyboard() {
  const rows = [];
  for (let i = 0; i < ASSET_OPTIONS.length; i += 2) {
    const row = [
      { text: ASSET_OPTIONS[i]!.label, callback_data: `as_${ASSET_OPTIONS[i]!.value}` },
    ];
    if (ASSET_OPTIONS[i + 1]) {
      row.push({ text: ASSET_OPTIONS[i + 1]!.label, callback_data: `as_${ASSET_OPTIONS[i + 1]!.value}` });
    }
    rows.push(row);
  }
  rows.push([{ text: "❌ لغو", callback_data: "alerts_menu" }]);
  return { inline_keyboard: rows };
}

const directionKeyboard = (asset: string) => ({
  inline_keyboard: [
    [
      { text: "📈 بالاتر از قیمت هدف", callback_data: `ad_above_${asset}` },
    ],
    [
      { text: "📉 پایین‌تر از قیمت هدف", callback_data: `ad_below_${asset}` },
    ],
    [{ text: "❌ لغو", callback_data: "alerts_menu" }],
  ],
});

// ─── /start ──────────────────────────────────────────────────────────────────
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  logger.info({ chatId, user: msg.from?.username }, "User started bot");

  // Upsert user into DB
  try {
    await db
      .insert(usersTable)
      .values({
        chatId,
        username: msg.from?.username ?? null,
        firstName: msg.from?.first_name ?? null,
      })
      .onConflictDoUpdate({
        target: usersTable.chatId,
        set: {
          username: msg.from?.username ?? null,
          firstName: msg.from?.first_name ?? null,
          lastSeenAt: new Date(),
        },
      });
  } catch (err) {
    logger.error({ err }, "Failed to upsert user");
  }

  await bot.sendMessage(chatId, WELCOME, {
    parse_mode: "Markdown",
    reply_markup: mainKeyboard,
  });
});

// ─── /stats (owner only) ──────────────────────────────────────────────────────
bot.onText(/\/stats/, async (msg) => {
  const fromId = msg.from?.id;
  logger.info({ fromId, OWNER_ID, match: fromId === OWNER_ID }, "/stats command received");
  if (fromId !== OWNER_ID) return;
  const chatId = msg.chat.id;
  try {
    const rows = await db.select({ total: count() }).from(usersTable);
    const total = rows[0]?.total ?? 0;
    await bot.sendMessage(chatId, `👥 تعداد کاربران: ${total}`);
  } catch (err) {
    logger.error({ err }, "Failed to fetch user count");
    await bot.sendMessage(chatId, "❌ خطا در دریافت آمار");
  }
});

// ─── Text input handler (price entry for alerts) ──────────────────────────────
bot.on("message", async (msg) => {
  if (!msg.text || msg.text.startsWith("/")) return;
  const chatId = msg.chat.id;
  const state = pending.get(chatId);
  if (!state || state.step !== "price") return;

  const raw = msg.text.replace(/[,،\s]/g, "");
  const price = parseFloat(raw);

  if (isNaN(price) || price <= 0) {
    await bot.sendMessage(chatId, "❌ لطفاً یک عدد معتبر وارد کنید (مثال: 5000000)");
    return;
  }

  try {
    await db.insert(alertsTable).values({
      chatId,
      username: msg.from?.username ?? null,
      asset: state.asset! as any,
      direction: state.direction!,
      targetPrice: price.toString(),
    });

    pending.delete(chatId);

    const dirText = state.direction === "above" ? "بالاتر از" : "پایین‌تر از";
    await bot.sendMessage(
      chatId,
      `✅ *هشدار ثبت شد!*\n\n` +
        `📌 دارایی: ${ASSET_LABEL[state.asset!]}\n` +
        `🎯 شرط: ${dirText} ${price.toLocaleString("fa-IR")} تومان\n\n` +
        `وقتی قیمت به هدف رسید به شما اطلاع داده می‌شود.`,
      { parse_mode: "Markdown", reply_markup: mainKeyboard }
    );
  } catch (err) {
    logger.error({ err }, "Failed to insert alert");
    await bot.sendMessage(chatId, "❌ خطا در ثبت هشدار. دوباره تلاش کنید.", {
      reply_markup: mainKeyboard,
    });
  }
});

// ─── Callback query handler ───────────────────────────────────────────────────
bot.on("callback_query", async (query) => {
  if (!query.message) return;

  const chatId = query.message.chat.id;
  const msgId = query.message.message_id;
  const data = query.data ?? "";

  // Silently ignore expired callback queries (bot was asleep, query timed out)
  try {
    await bot.answerCallbackQuery(query.id);
  } catch (e: any) {
    if (e?.message?.includes("query is too old") || e?.message?.includes("query ID is invalid")) {
      return; // stale query — discard silently
    }
  }

  try {
    // ── Main menu ──
    if (data === "menu") {
      await bot.editMessageText(WELCOME, {
        chat_id: chatId,
        message_id: msgId,
        parse_mode: "Markdown",
        reply_markup: mainKeyboard,
      });
      return;
    }

    // ── Crypto metadata menu ──
    if (data === "crypto_info_menu") {
      await bot.editMessageText(
        "💎 *اطلاعات ارزهای دیجیتال*\n\nبرای مشاهدهٔ قیمت، شبکه و آدرس کانترکت یک ارز را انتخاب کنید:",
        {
          chat_id: chatId,
          message_id: msgId,
          parse_mode: "Markdown",
          reply_markup: cryptoInfoKeyboard,
        },
      );
      return;
    }

    // ── Crypto metadata and live price ──
    if (data.startsWith("crypto_info_")) {
      const symbol = data.slice("crypto_info_".length) as CryptoSymbol;
      const coin = CRYPTO_DATABASE[symbol];
      if (!coin) return;

      await bot.editMessageText("⏳ در حال دریافت قیمت لحظه‌ای...", {
        chat_id: chatId,
        message_id: msgId,
      });

      try {
        const text = await getCryptoDetailsText(symbol);
        await bot.editMessageText(text, {
          chat_id: chatId,
          message_id: msgId,
          parse_mode: "Markdown",
          reply_markup: cryptoDetailsKeyboard(symbol),
        });
      } catch (err) {
        logger.error({ err, symbol }, "Failed to fetch crypto details");
        await bot.editMessageText(
          "❌ دریافت اطلاعات ارز ناموفق بود. لطفاً دوباره تلاش کنید.",
          {
            chat_id: chatId,
            message_id: msgId,
            reply_markup: cryptoInfoKeyboard,
          },
        );
      }
      return;
    }

    // ── Price sections ──
    const section = data.startsWith("refresh_") ? data.replace("refresh_", "") : data;
    if (["gold", "coin", "currency", "crypto", "all", "parsian_coin"].includes(section)) {
      let text = "";
      if (section === "gold") text = await getGoldText();
      else if (section === "coin") text = await getCoinText();
      else if (section === "parsian_coin") text = await getCoinParsianText();
      else if (section === "currency") text = await getCurrencyText();
      else if (section === "crypto") text = await getCryptoText();
      else text = await getAllText();

      await bot.editMessageText(text, {
        chat_id: chatId,
        message_id: msgId,
        parse_mode: "Markdown",
        reply_markup: makeBackKeyboard(section),
      });
      return;
    }

    // ── Step 1: Chart category menu ──
    if (data === "chart_menu") {
      await bot.editMessageText(
        `📈 *نمودار قیمت*\n\nدسته‌بندی مورد نظر را انتخاب کنید:`,
        {
          chat_id: chatId,
          message_id: msgId,
          parse_mode: "Markdown",
          reply_markup: chartCategoryKeyboard,
        }
      );
      return;
    }

    // ── Step 2: Asset selection within category ──
    if (data.startsWith("chartcat_")) {
      const category = data.slice("chartcat_".length) as ChartCategory;
      const cat = CHART_CATEGORIES[category];
      if (!cat) return;
      await bot.editMessageText(
        `📈 *نمودار › ${cat.emoji} ${cat.label}*\n\nکدام دارایی؟`,
        {
          chat_id: chatId,
          message_id: msgId,
          parse_mode: "Markdown",
          reply_markup: chartAssetKeyboard(category),
        }
      );
      return;
    }

    // ── Step 3: Period selection ──
    if (data.startsWith("chartasset_")) {
      const rest = data.slice("chartasset_".length);   // e.g. "gold_gold18"
      const sepIdx = rest.indexOf("_");
      if (sepIdx === -1) return;
      const category = rest.slice(0, sepIdx) as ChartCategory;
      const assetKey = rest.slice(sepIdx + 1);
      const cat = CHART_CATEGORIES[category];
      const assetDef = CHART_ASSETS[category]?.find(a => a.key === assetKey);
      if (!cat || !assetDef) return;
      await bot.editMessageText(
        `📈 *نمودار › ${cat.emoji} ${cat.label} › ${assetDef.emoji} ${assetDef.label}*\n\nبازه زمانی را انتخاب کنید:`,
        {
          chat_id: chatId,
          message_id: msgId,
          parse_mode: "Markdown",
          reply_markup: chartPeriodKeyboard(category, assetKey),
        }
      );
      return;
    }

    // ── Step 4: Generate & send chart ──
    if (data.startsWith("chartshow_")) {
      const parts = data.split("_"); // ["chartshow", category, assetKey, period]
      if (parts.length < 4) return;  // ignore legacy 3-part callbacks
      const category = parts[1] as ChartCategory;
      const period   = parts[parts.length - 1] as ChartPeriod;
      const assetKey = parts.slice(2, parts.length - 1).join("_");

      if (!CHART_CATEGORIES[category] || !PERIOD_LABELS[period]) return;

      await bot.editMessageText(`⏳ در حال دریافت داده‌ها و رسم نمودار…`, {
        chat_id: chatId,
        message_id: msgId,
      });

      try {
        const { buffer, caption } = await generateChartBuffer(category, assetKey, period);
        await bot.sendPhoto(chatId, buffer, {
          caption,
          parse_mode: "Markdown",
          reply_markup: chartAfterKeyboard(category, assetKey),
        });
        await bot.deleteMessage(chatId, msgId).catch(() => {});
      } catch (chartErr) {
        logger.error({ chartErr }, "Chart generation failed");
        await bot.editMessageText(
          "❌ خطا در دریافت داده‌های نمودار. لطفاً دوباره تلاش کنید.",
          {
            chat_id: chatId,
            message_id: msgId,
            reply_markup: chartCategoryKeyboard,
          }
        );
      }
      return;
    }

    // ── menu_new: send a fresh main menu message ──
    if (data === "menu_new") {
      await bot.sendMessage(chatId, WELCOME, {
        parse_mode: "Markdown",
        reply_markup: mainKeyboard,
      });
      return;
    }

    // ── Alerts menu ──
    if (data === "alerts_menu") {
      pending.delete(chatId);
      await bot.editMessageText(
        `🔔 *هشدارهای قیمت*\n\nهنگامی که قیمت به هدف شما برسد، پیام دریافت می‌کنید.`,
        {
          chat_id: chatId,
          message_id: msgId,
          parse_mode: "Markdown",
          reply_markup: alertsMenuKeyboard,
        }
      );
      return;
    }

    // ── Add alert: step 1 — choose asset ──
    if (data === "alert_add") {
      pending.set(chatId, { step: "asset" });
      await bot.editMessageText("📌 *کدام دارایی را می‌خواهید رصد کنید؟*", {
        chat_id: chatId,
        message_id: msgId,
        parse_mode: "Markdown",
        reply_markup: assetSelectionKeyboard(),
      });
      return;
    }

    // ── Add alert: step 2 — choose direction ──
    if (data.startsWith("as_")) {
      const asset = data.replace("as_", "");
      pending.set(chatId, { step: "direction", asset });
      await bot.editMessageText(
        `📌 دارایی: *${ASSET_LABEL[asset]}*\n\nهشدار چه زمانی ارسال شود؟`,
        {
          chat_id: chatId,
          message_id: msgId,
          parse_mode: "Markdown",
          reply_markup: directionKeyboard(asset),
        }
      );
      return;
    }

    // ── Add alert: step 3 — enter price ──
    if (data.startsWith("ad_")) {
      const [, dir, ...rest] = data.split("_");
      const asset = rest.join("_");
      const direction = dir as "above" | "below";
      pending.set(chatId, { step: "price", asset, direction });

      const dirText = direction === "above" ? "بالاتر از" : "پایین‌تر از";
      await bot.editMessageText(
        `📌 دارایی: *${ASSET_LABEL[asset]}*\n` +
          `🎯 شرط: ${dirText} قیمت هدف\n\n` +
          `💰 قیمت هدف را به *تومان* وارد کنید:\n_(مثال: 5000000)_`,
        {
          chat_id: chatId,
          message_id: msgId,
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [[{ text: "❌ لغو", callback_data: "alerts_menu" }]],
          },
        }
      );
      return;
    }

    // ── List alerts ──
    if (data === "alert_list") {
      const alerts = await db
        .select()
        .from(alertsTable)
        .where(and(eq(alertsTable.chatId, chatId), eq(alertsTable.active, true)));

      if (alerts.length === 0) {
        await bot.editMessageText(
          `📋 *هشدارهای فعال*\n\nشما هیچ هشدار فعالی ندارید.`,
          {
            chat_id: chatId,
            message_id: msgId,
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [{ text: "➕ افزودن هشدار", callback_data: "alert_add" }],
                [{ text: "🏠 بازگشت", callback_data: "menu" }],
              ],
            },
          }
        );
        return;
      }

      let text = `📋 *هشدارهای فعال شما*\n\n`;
      const deleteButtons = [];
      for (const alert of alerts) {
        const dirText = alert.direction === "above" ? "📈 بالاتر از" : "📉 پایین‌تر از";
        const price = parseFloat(alert.targetPrice).toLocaleString("fa-IR");
        text += `• ${ASSET_LABEL[alert.asset]} — ${dirText} ${price} تومان\n`;
        deleteButtons.push([
          {
            text: `🗑 حذف: ${ASSET_LABEL[alert.asset]}`,
            callback_data: `alert_del_${alert.id}`,
          },
        ]);
      }

      deleteButtons.push([{ text: "➕ افزودن هشدار جدید", callback_data: "alert_add" }]);
      deleteButtons.push([{ text: "🏠 بازگشت به منو", callback_data: "menu" }]);

      await bot.editMessageText(text, {
        chat_id: chatId,
        message_id: msgId,
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: deleteButtons },
      });
      return;
    }

    // ── Delete alert ──
    if (data.startsWith("alert_del_")) {
      const alertId = parseInt(data.replace("alert_del_", ""), 10);
      await db
        .update(alertsTable)
        .set({ active: false })
        .where(and(eq(alertsTable.id, alertId), eq(alertsTable.chatId, chatId)));

      await bot.answerCallbackQuery(query.id, { text: "✅ هشدار حذف شد" });

      // Re-render the list
      const alerts = await db
        .select()
        .from(alertsTable)
        .where(and(eq(alertsTable.chatId, chatId), eq(alertsTable.active, true)));

      if (alerts.length === 0) {
        await bot.editMessageText(`📋 *هشدارهای فعال*\n\nهیچ هشدار فعالی ندارید.`, {
          chat_id: chatId,
          message_id: msgId,
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "➕ افزودن هشدار", callback_data: "alert_add" }],
              [{ text: "🏠 بازگشت", callback_data: "menu" }],
            ],
          },
        });
        return;
      }

      let text = `📋 *هشدارهای فعال شما*\n\n`;
      const deleteButtons = [];
      for (const alert of alerts) {
        const dirText = alert.direction === "above" ? "📈 بالاتر از" : "📉 پایین‌تر از";
        const price = parseFloat(alert.targetPrice).toLocaleString("fa-IR");
        text += `• ${ASSET_LABEL[alert.asset]} — ${dirText} ${price} تومان\n`;
        deleteButtons.push([
          {
            text: `🗑 حذف: ${ASSET_LABEL[alert.asset]}`,
            callback_data: `alert_del_${alert.id}`,
          },
        ]);
      }
      deleteButtons.push([{ text: "➕ افزودن هشدار جدید", callback_data: "alert_add" }]);
      deleteButtons.push([{ text: "🏠 بازگشت به منو", callback_data: "menu" }]);

      await bot.editMessageText(text, {
        chat_id: chatId,
        message_id: msgId,
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: deleteButtons },
      });
      return;
    }
  } catch (err) {
    logger.error({ err, data }, "Error handling callback query");
    try {
      await bot.sendMessage(chatId, "❌ خطایی رخ داد. لطفاً دوباره تلاش کنید.", {
        reply_markup: mainKeyboard,
      });
    } catch {}
  }
});

bot.on("polling_error", (err: any) => {
  logger.error({ code: err.code, message: err.message }, "Telegram polling error");

  // EFATAL means polling has completely stopped — restart it
  if (err.code === "EFATAL") {
    logger.warn("Fatal polling error — restarting polling in 10s");
    setTimeout(() => {
      bot.startPolling({ restart: true }).catch((e) => {
        logger.error({ e }, "Failed to restart polling");
      });
    }, 10_000);
  }
});

process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "Unhandled promise rejection");
});

process.on("uncaughtException", (err) => {
  logger.error({ err }, "Uncaught exception");
});

logger.info("Telegram bot started");
