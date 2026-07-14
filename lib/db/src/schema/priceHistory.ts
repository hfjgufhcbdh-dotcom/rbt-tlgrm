import { pgTable, serial, varchar, numeric, timestamp } from "drizzle-orm/pg-core";

export const priceHistoryTable = pgTable("price_history", {
  id: serial("id").primaryKey(),
  asset: varchar("asset", { length: 20 }).notNull(),
  priceUsd: numeric("price_usd", { precision: 20, scale: 6 }).notNull(),
  priceToman: numeric("price_toman", { precision: 20, scale: 2 }).notNull(),
  recordedAt: timestamp("recorded_at").notNull().defaultNow(),
});

export type PriceHistoryRow = typeof priceHistoryTable.$inferSelect;
