import { pgTable, bigint, varchar, timestamp } from "drizzle-orm/pg-core";

export const usersTable = pgTable("bot_users", {
  chatId: bigint("chat_id", { mode: "number" }).primaryKey(),
  username: varchar("username", { length: 255 }),
  firstName: varchar("first_name", { length: 255 }),
  firstSeenAt: timestamp("first_seen_at").notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
});

export type BotUser = typeof usersTable.$inferSelect;
