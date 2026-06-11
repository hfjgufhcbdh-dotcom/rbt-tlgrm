import axios from "axios";
import { logger } from "./logger";

export interface PriceData {
  gold18: string;
  gold24: string;
  mithqal: string;
  emamiCoin: string;
  baharCoin: string;
  halfCoin: string;
  quarterCoin: string;
  usd: string;
  eur: string;
  gbp: string;
  aed: string;
  usdt: string;
  updatedAt: string;
}

function formatPrice(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return "نامشخص";
  return value.toLocaleString("fa-IR") + " تومان";
}

// tgju.org - widely accessible public market data API
async function fetchFromTgju(): Promise<PriceData> {
  const { data } = await axios.get("https://call.tgju.org/ajax.json", {
    timeout: 10000,
    headers: {
      "User-Agent": "Mozilla/5.0",
      Accept: "application/json",
      Referer: "https://www.tgju.org/",
    },
  });

  const current = data?.current ?? {};

  const price = (key: string): string => {
    const raw = current[key]?.p;
    if (!raw) return "نامشخص";
    const num = parseInt(String(raw).replace(/,/g, ""), 10);
    return isNaN(num) ? "نامشخص" : formatPrice(Math.round(num / 10));
  };

  return {
    gold18: price("geram18"),
    gold24: price("geram24"),
    mithqal: price("mesghal"),
    emamiCoin: price("sekee"),
    baharCoin: price("sekeb"),
    halfCoin: price("nim"),
    quarterCoin: price("rob"),
    usd: price("price_dollar_rl"),
    eur: price("price_eur"),
    gbp: price("price_gbp"),
    aed: price("price_aed"),
    usdt: price("crypto-tether"),
    updatedAt: new Date().toLocaleTimeString("fa-IR"),
  };
}

// navasan.tech public endpoint (no key required for basic data)
async function fetchFromNavasan(): Promise<PriceData> {
  const { data } = await axios.get(
    "https://api.navasan.tech/latest/?api=free_usd_buy",
    { timeout: 8000 }
  );

  const usdRial = data?.value ? parseInt(data.value, 10) : null;
  const usdToman = usdRial ? Math.round(usdRial / 10) : null;

  return {
    gold18: "نامشخص",
    gold24: "نامشخص",
    mithqal: "نامشخص",
    emamiCoin: "نامشخص",
    baharCoin: "نامشخص",
    halfCoin: "نامشخص",
    quarterCoin: "نامشخص",
    usd: usdToman ? formatPrice(usdToman) : "نامشخص",
    eur: "نامشخص",
    gbp: "نامشخص",
    aed: "نامشخص",
    usdt: "نامشخص",
    updatedAt: new Date().toLocaleTimeString("fa-IR"),
  };
}

let lastSuccessfulData: PriceData | null = null;

export async function fetchLivePrices(): Promise<PriceData> {
  // Try primary: tgju.org
  try {
    const result = await fetchFromTgju();
    lastSuccessfulData = result;
    return result;
  } catch (err) {
    logger.warn({ err: (err as Error).message }, "tgju.org failed, trying navasan");
  }

  // Try secondary: navasan.tech
  try {
    const result = await fetchFromNavasan();
    lastSuccessfulData = result;
    return result;
  } catch (err) {
    logger.warn({ err: (err as Error).message }, "navasan.tech also failed");
  }

  // Return last known good data if available
  if (lastSuccessfulData) {
    logger.warn("All APIs failed, returning last known prices");
    return {
      ...lastSuccessfulData,
      updatedAt: lastSuccessfulData.updatedAt + " (قدیمی)",
    };
  }

  // Final fallback: return error state
  logger.error("All price APIs failed and no cached data available");
  const na = "خطا در دریافت";
  return {
    gold18: na, gold24: na, mithqal: na,
    emamiCoin: na, baharCoin: na, halfCoin: na, quarterCoin: na,
    usd: na, eur: na, gbp: na, aed: na, usdt: na,
    updatedAt: new Date().toLocaleTimeString("fa-IR"),
  };
}
