import { pgTable, serial, bigint, varchar, numeric, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const assetEnum = pgEnum("asset", [
  "gold18",
  "gold24",
  "mithqal",
  "emamiCoin",
  "baharCoin",
  "halfCoin",
  "quarterCoin",
  "usd",
  "eur",
  "gbp",
  "aed",
  "usdt",
]);

export const directionEnum = pgEnum("direction", ["above", "below"]);

export const alertsTable = pgTable("price_alerts", {
  id: serial("id").primaryKey(),
  chatId: bigint("chat_id", { mode: "number" }).notNull(),
  username: varchar("username", { length: 255 }),
  asset: assetEnum("asset").notNull(),
  direction: directionEnum("direction").notNull(),
  targetPrice: numeric("target_price", { precision: 18, scale: 2 }).notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  triggeredAt: timestamp("triggered_at"),
});

export const insertAlertSchema = createInsertSchema(alertsTable).omit({
  id: true,
  createdAt: true,
  triggeredAt: true,
  active: true,
});

export type InsertAlert = z.infer<typeof insertAlertSchema>;
export type Alert = typeof alertsTable.$inferSelect;
