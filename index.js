const TelegramBot = require('node-telegram-bot-api');

// توکن ربات تلگرام خودت را اینجا بگذار
const token = 'YOUR_TELEGRAM_BOT_TOKEN';

const bot = new TelegramBot(token, { polling: true });

bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  console.log(`Received message: ${text}`);
  bot.sendMessage(chatId, 'ربات با موفقیت روشن شد و پیام شما را دریافت کرد!');
});

console.log("Bot is running and waiting for messages...");
