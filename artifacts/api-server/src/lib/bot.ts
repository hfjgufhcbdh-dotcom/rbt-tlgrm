import TelegramBot from "node-telegram-bot-api";
import { fetchLivePrices } from "./prices";
import { logger } from "./logger";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!TOKEN) {
  throw new Error("TELEGRAM_BOT_TOKEN environment variable is required");
}

const bot = new TelegramBot(TOKEN, { polling: true });

const mainKeyboard = {
  inline_keyboard: [
    [{ text: "🥇 قیمت طلا", callback_data: "gold" }],
    [{ text: "🪙 قیمت سکه", callback_data: "coin" }],
    [{ text: "💵 قیمت ارز", callback_data: "currency" }],
    [{ text: "📊 همه قیمت‌ها", callback_data: "all" }],
  ],
};

const backKeyboard = {
  inline_keyboard: [
    [{ text: "🔄 بروزرسانی", callback_data: "refresh_last" }],
    [{ text: "🏠 بازگشت به منو", callback_data: "menu" }],
  ],
};

function makeBackKeyboard(section: string) {
  return {
    inline_keyboard: [
      [{ text: "🔄 بروزرسانی", callback_data: `refresh_${section}` }],
      [{ text: "🏠 بازگشت به منو", callback_data: "menu" }],
    ],
  };
}

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

async function getCurrencyText() {
  const p = await fetchLivePrices();
  return (
    `💵 *قیمت ارز*\n\n` +
    `🇺🇸 دلار آمریکا: \`${p.usd}\`\n` +
    `🇪🇺 یورو: \`${p.eur}\`\n` +
    `🇬🇧 پوند انگلیس: \`${p.gbp}\`\n` +
    `🇦🇪 درهم امارات: \`${p.aed}\`\n` +
    `₮ تتر: \`${p.usdt}\`\n\n` +
    `🕐 آخرین بروزرسانی: ${p.updatedAt}`
  );
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
    `₮ تتر: \`${p.usdt}\`\n\n` +
    `🕐 آخرین بروزرسانی: ${p.updatedAt}`
  );
}

const WELCOME =
  `🤖 *ربات قیمت طلا، سکه و ارز*\n\n` +
  `به ربات قیمت لحظه‌ای خوش آمدید\\!\n` +
  `قیمت‌ها به‌صورت لحظه‌ای از بازار دریافت می‌شوند\\.\n\n` +
  `یکی از گزینه‌ها را انتخاب کنید:`;

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  logger.info({ chatId, user: msg.from?.username }, "User started bot");
  await bot.sendMessage(chatId, WELCOME, {
    parse_mode: "MarkdownV2",
    reply_markup: mainKeyboard,
  });
});

bot.on("callback_query", async (query) => {
  if (!query.message) return;

  const chatId = query.message.chat.id;
  const msgId = query.message.message_id;
  const data = query.data ?? "";

  await bot.answerCallbackQuery(query.id);

  try {
    if (data === "menu") {
      await bot.editMessageText(WELCOME, {
        chat_id: chatId,
        message_id: msgId,
        parse_mode: "MarkdownV2",
        reply_markup: mainKeyboard,
      });
      return;
    }

    const section = data.startsWith("refresh_") ? data.replace("refresh_", "") : data;

    let text = "";
    if (section === "gold") {
      text = await getGoldText();
    } else if (section === "coin") {
      text = await getCoinText();
    } else if (section === "currency") {
      text = await getCurrencyText();
    } else if (section === "all") {
      text = await getAllText();
    }

    if (text) {
      await bot.editMessageText(text, {
        chat_id: chatId,
        message_id: msgId,
        parse_mode: "Markdown",
        reply_markup: makeBackKeyboard(section),
      });
    }
  } catch (err) {
    logger.error({ err, data }, "Error handling callback query");
    try {
      await bot.sendMessage(chatId, "❌ خطا در دریافت قیمت‌ها. لطفاً دوباره تلاش کنید.", {
        reply_markup: mainKeyboard,
      });
    } catch {
    }
  }
});

bot.on("polling_error", (err) => {
  logger.error({ err }, "Telegram polling error");
});

logger.info("Telegram bot started");

export { bot };
