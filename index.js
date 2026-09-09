export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("Bot is running!", { status: 200 });
    }

    const update = await request.json();

    if (update.message) {
      const chatId = update.message.chat.id;
      const text = update.message.text || "";

      console.log(`Received message: ${text}`);

      await fetch(
        `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            chat_id: chatId,
            text: "ربات با موفقیت روشن شد و پیام شما را دریافت کرد!"
          })
        }
      );
    }

    return new Response("OK", { status: 200 });
  }
};
