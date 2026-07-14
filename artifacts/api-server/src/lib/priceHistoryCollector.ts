import { db } from "@workspace/db";
import { priceHistoryTable } from "@workspace/db/schema";
import { fetchLivePrices } from "./prices";
import { logger } from "./logger";

const CHART_ASSETS = ["btc", "eth", "ton", "gold"] as const;

async function collectSnapshot() {
  try {
    const p = await fetchLivePrices();

    const usdToToman = parseFloat(p.usd.replace(/[^0-9.]/g, "")) || 0;

    const snapshots: { asset: string; priceUsd: string; priceToman: string }[] = [];

    for (const asset of CHART_ASSETS) {
      let priceUsd = "0";
      let priceToman = "0";

      if (asset === "btc") {
        const raw = p.btc.split("|")[0]?.trim().replace(/[$,]/g, "") ?? "0";
        priceUsd = raw;
        priceToman = usdToToman > 0
          ? String(Math.round(parseFloat(raw) * usdToToman))
          : "0";
      } else if (asset === "eth") {
        const raw = p.eth.split("|")[0]?.trim().replace(/[$,]/g, "") ?? "0";
        priceUsd = raw;
        priceToman = usdToToman > 0
          ? String(Math.round(parseFloat(raw) * usdToToman))
          : "0";
      } else if (asset === "ton") {
        const raw = p.ton.split("|")[0]?.trim().replace(/[$,]/g, "") ?? "0";
        priceUsd = raw;
        priceToman = usdToToman > 0
          ? String(Math.round(parseFloat(raw) * usdToToman))
          : "0";
      } else if (asset === "gold") {
        priceToman = p.gold24.replace(/[^0-9]/g, "");
        priceUsd = usdToToman > 0
          ? String((parseFloat(priceToman) / usdToToman).toFixed(2))
          : "0";
      }

      snapshots.push({ asset, priceUsd, priceToman });
    }

    await db.insert(priceHistoryTable).values(
      snapshots.map((s) => ({
        asset: s.asset,
        priceUsd: s.priceUsd,
        priceToman: s.priceToman,
      }))
    );

    logger.info({ assets: CHART_ASSETS.length }, "Price history snapshot saved");
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
