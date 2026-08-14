import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import { userCoinsTable } from "@workspace/db/schema";
import { fetchCoinGeckoUsd } from "./prices";

export const DEFAULT_USER_COIN_IDS = [
  "rabbitcoin",
  "memefi",
  "bitcoin",
  "ethereum",
] as const;

const COIN_ALIASES: Record<string, string> = {
  rbtc: "rabbitcoin",
  rb: "rabbitcoin",
  btc: "bitcoin",
  eth: "ethereum",
  sol: "solana",
  ton: "the-open-network",
  toncoin: "the-open-network",
  usdt: "tether",
};

export function normalizeCoinId(value: string): string {
  const normalized = value.trim().toLowerCase();
  return COIN_ALIASES[normalized] ?? normalized;
}

export function isValidCoinId(value: string): boolean {
  return /^[a-z0-9-]{2,100}$/.test(value);
}

export async function ensureDefaultUserCoins(chatId: number): Promise<void> {
  await db
    .insert(userCoinsTable)
    .values(DEFAULT_USER_COIN_IDS.map((coinId) => ({ chatId, coinId })))
    .onConflictDoNothing();
}

export async function getUserCoinIds(chatId: number): Promise<string[]> {
  const rows = await db
    .select({ coinId: userCoinsTable.coinId })
    .from(userCoinsTable)
    .where(eq(userCoinsTable.chatId, chatId))
    .orderBy(asc(userCoinsTable.createdAt));

  return rows.map((row) => row.coinId);
}

export async function getUserCoinIdsForChats(
  chatIds: number[],
): Promise<Map<number, string[]>> {
  const result = new Map<number, string[]>();
  if (chatIds.length === 0) return result;

  const rows = await db
    .select({
      chatId: userCoinsTable.chatId,
      coinId: userCoinsTable.coinId,
    })
    .from(userCoinsTable)
    .where(inArray(userCoinsTable.chatId, chatIds))
    .orderBy(asc(userCoinsTable.createdAt));

  for (const row of rows) {
    const current = result.get(row.chatId) ?? [];
    current.push(row.coinId);
    result.set(row.chatId, current);
  }

  return result;
}

export async function addUserCoin(
  chatId: number,
  rawCoinId: string,
): Promise<
  | { ok: true; coinId: string; alreadyExists: boolean }
  | { ok: false; reason: "invalid" | "not_found" }
> {
  const coinId = normalizeCoinId(rawCoinId);
  if (!isValidCoinId(coinId)) {
    return { ok: false, reason: "invalid" };
  }

  const price = await fetchCoinGeckoUsd(coinId);
  if (price === null) {
    return { ok: false, reason: "not_found" };
  }

  await ensureDefaultUserCoins(chatId);
  const inserted = await db
    .insert(userCoinsTable)
    .values({ chatId, coinId })
    .onConflictDoNothing()
    .returning({ coinId: userCoinsTable.coinId });

  return {
    ok: true,
    coinId,
    alreadyExists: inserted.length === 0,
  };
}