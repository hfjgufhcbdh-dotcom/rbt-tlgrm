import { db } from "@workspace/db";
import { priceHistoryTable } from "@workspace/db/schema";
import { fetchLivePrices, fetchRawPrices } from "./prices";
import { logger } from "./logger";

async function collectSnapshot() {
  try {
    // ensure prices are fresh; fetchLivePrices also populates cachedRaw
    await fetchLivePrices();
    const raw = await fetchRawPrices();
    if (!raw) return;

    const { usdToToman, btcUsd, ethUsd, tonUsd, gold24PerGramToman } = raw;

    const snapshots = [
      {
        asset: "btc",
        priceUsd: btcUsd.toFixed(2),
        priceToman: String(Math.round(btcUsd * usdToToman)),
      },
      {
        asset: "eth",
        priceUsd: ethUsd.toFixed(2),
        priceToman: String(Math.round(ethUsd * usdToToman)),
      },
      {
        asset: "ton",
        priceUsd: tonUsd.toFixed(4),
        priceToman: String(Math.round(tonUsd * usdToToman)),
      },
      {
        asset: "gold",
        priceUsd: (gold24PerGramToman / usdToToman).toFixed(4),
        priceToman: String(Math.round(gold24PerGramToman)),
      },
    ];

    await db.insert(priceHistoryTable).values(snapshots);
    logger.info({ count: snapshots.length }, "Price history snapshot saved");
  } catch (err) {
    logger.error({ err }, "Price history collection failed");
  }
}

export function startPriceHistoryCollector() {
  const INTERVAL_MS = 60 * 60 * 1000;

  collectSnapshot();
  setInterval(collectSnapshot, INTERVAL_MS);
  logger.info({ intervalMs: INTERVAL_MS }, "Price history collector started");
}
