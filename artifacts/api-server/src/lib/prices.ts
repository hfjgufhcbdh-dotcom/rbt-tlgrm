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

export async function fetchLivePrices(): Promise<PriceData> {
  try {
    const { data } = await axios.get(
      "https://brsapi.ir/FreeTsetmcBrsApi/Api_Free_Gold_Currency_v2.json",
      { timeout: 8000 }
    );

    const gold = data?.gold ?? {};
    const currency = data?.currency ?? {};

    const findCurrency = (code: string) =>
      currency.find?.((c: { symbol: string }) => c.symbol === code);

    const usdObj = findCurrency("USD");
    const eurObj = findCurrency("EUR");
    const gbpObj = findCurrency("GBP");
    const aedObj = findCurrency("AED");
    const usdtObj = findCurrency("USDT");

    return {
      gold18: formatPrice(gold.gold_18),
      gold24: formatPrice(gold.gold_24),
      mithqal: formatPrice(gold.mithqal),
      emamiCoin: formatPrice(gold.emami_coin),
      baharCoin: formatPrice(gold.bahar_coin),
      halfCoin: formatPrice(gold.half_coin),
      quarterCoin: formatPrice(gold.quarter_coin),
      usd: formatPrice(usdObj?.price),
      eur: formatPrice(eurObj?.price),
      gbp: formatPrice(gbpObj?.price),
      aed: formatPrice(aedObj?.price),
      usdt: formatPrice(usdtObj?.price),
      updatedAt: new Date().toLocaleTimeString("fa-IR"),
    };
  } catch (err) {
    logger.error({ err }, "Failed to fetch prices from primary API, trying fallback");
    return fetchFallbackPrices();
  }
}

async function fetchFallbackPrices(): Promise<PriceData> {
  try {
    const { data } = await axios.get(
      "https://api.accessban.com/v1/market/indicator/summary-data-compact",
      { timeout: 8000 }
    );

    const get = (key: string) => {
      const item = data?.data?.[key];
      return item ? formatPrice(Number(item.p)) : "نامشخص";
    };

    return {
      gold18: get("geram18"),
      gold24: get("geram24"),
      mithqal: get("mesghal"),
      emamiCoin: get("emami"),
      baharCoin: get("bahar"),
      halfCoin: get("nim"),
      quarterCoin: get("rob"),
      usd: get("dollar"),
      eur: get("euro"),
      gbp: get("pound"),
      aed: get("dirham"),
      usdt: get("tether"),
      updatedAt: new Date().toLocaleTimeString("fa-IR"),
    };
  } catch (err) {
    logger.error({ err }, "Fallback API also failed");
    return {
      gold18: "خطا در دریافت",
      gold24: "خطا در دریافت",
      mithqal: "خطا در دریافت",
      emamiCoin: "خطا در دریافت",
      baharCoin: "خطا در دریافت",
      halfCoin: "خطا در دریافت",
      quarterCoin: "خطا در دریافت",
      usd: "خطا در دریافت",
      eur: "خطا در دریافت",
      gbp: "خطا در دریافت",
      aed: "خطا در دریافت",
      usdt: "خطا در دریافت",
      updatedAt: new Date().toLocaleTimeString("fa-IR"),
    };
  }
}
