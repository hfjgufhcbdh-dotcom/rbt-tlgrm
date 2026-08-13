import type TelegramBot from "node-telegram-bot-api";

type SendMessageOptions = Parameters<TelegramBot["sendMessage"]>[2];
type SendPhotoOptions = Parameters<TelegramBot["sendPhoto"]>[2];
type Photo = Parameters<TelegramBot["sendPhoto"]>[1];

const MAX_TRACKED_MESSAGES_PER_CHAT = 10;
const trackedMessageIds = new Map<number, Set<number>>();

function rememberMessage(chatId: number, messageId: number): void {
  let messageIds = trackedMessageIds.get(chatId);

  if (!messageIds) {
    messageIds = new Set<number>();
    trackedMessageIds.set(chatId, messageIds);
  }

  messageIds.add(messageId);
  while (messageIds.size > MAX_TRACKED_MESSAGES_PER_CHAT) {
    const oldestMessageId = messageIds.values().next().value as number | undefined;
    if (oldestMessageId === undefined) break;
    messageIds.delete(oldestMessageId);
  }
}

export async function sendMessageAndSave(
  bot: TelegramBot,
  chatId: number,
  text: string,
  options?: SendMessageOptions,
) {
  const sentMessage = await bot.sendMessage(chatId, text, options);
  rememberMessage(chatId, sentMessage.message_id);
  return sentMessage;
}

export async function sendPhotoAndSave(
  bot: TelegramBot,
  chatId: number,
  photo: Photo,
  options?: SendPhotoOptions,
) {
  const sentMessage = await bot.sendPhoto(chatId, photo, options);
  rememberMessage(chatId, sentMessage.message_id);
  return sentMessage;
}

export async function deleteTrackedMessages(
  bot: TelegramBot,
  chatId: number,
): Promise<{ deleted: number; failed: number }> {
  const messageIds = trackedMessageIds.get(chatId);
  if (!messageIds || messageIds.size === 0) {
    return { deleted: 0, failed: 0 };
  }

  trackedMessageIds.delete(chatId);
  const results = await Promise.allSettled(
    [...messageIds].map((messageId) => bot.deleteMessage(chatId, messageId)),
  );

  return {
    deleted: results.filter((result) => result.status === "fulfilled").length,
    failed: results.filter((result) => result.status === "rejected").length,
  };
}