import { bigint, pgTable, primaryKey, timestamp, varchar } from "drizzle-orm/pg-core";

export const userCoinsTable = pgTable(
  "bot_user_coins",
  {
    chatId: bigint("chat_id", { mode: "number" }).notNull(),
    coinId: varchar("coin_id", { length: 100 }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    primaryKey: primaryKey({ columns: [table.chatId, table.coinId] }),
  }),
);

export type UserCoin = typeof userCoinsTable.$inferSelect;