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

// --- helpers ---

function toman(amount: number): string {
  return Math.round(amount).toLocaleString("fa-IR") + " تومان";
}

// Troy ounce in grams
const TROY_OZ_GRAMS = 31.1035;

// Iranian gold coin specs (grams of pure gold equivalent)
// Emami / Bahar Azadi: 8.133g at 22K = 8.133*(22/24) pure gold
// Half coin: 4.068g at 22K
// Quarter coin: 2.034g at 22K
const COIN_SPECS = {
  emami: { grams: 8.133, purity: 22 / 24, premium: 0.17 },
  bahar: { grams: 8.133, purity: 22 / 24, premium: 0.12 },
  half: { grams: 4.068, purity: 22 / 24, premium: 0.14 },
  quarter: { grams: 2.034, purity: 22 / 24, premium: 0.16 },
};

function coinPrice(
  goldPerGramPure: number, // Toman per gram of 24K gold
  spec: { grams: number; purity: number; premium: number }
): string {
  const baseValue = spec.grams * spec.purity * goldPerGramPure;
  return toman(baseValue * (1 + spec.premium));
}

// --- data fetching ---

interface Rates {
  usdToToman: number; // 1 USD in Toman
  eurToToman: number;
  gbpToToman: number;
  aedToToman: number;
}

async function fetchExchangeRates(): Promise<Rates> {
  const { data } = await axios.get("https://open.er-api.com/v6/latest/USD", {
    timeout: 8000,
  });

  const r = data.rates;
  // open.er-api gives IRR (Iranian Rial). 1 Toman = 10 Rials.
  const usdToToman = r.IRR / 10;

  return {
    usdToToman,
    eurToToman: usdToToman / r.EUR,
    gbpToToman: usdToToman / r.GBP,
    aedToToman: usdToToman / r.AED,
  };
}

async function fetchGoldUsd(): Promise<number> {
  const { data } = await axios.get(
    "https://api.coinbase.com/v2/prices/XAU-USD/spot",
    { timeout: 8000 }
  );
  return parseFloat(data.data.amount); // USD per troy ounce
}

async function fetchUsdtUsd(): Promise<number> {
  const { data } = await axios.get(
    "https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=usd",
    { timeout: 8000 }
  );
  return data.tether.usd as number; // ≈ 1.00
}

// --- main export ---

let cachedData: PriceData | null = null;

export async function fetchLivePrices(): Promise<PriceData> {
  try {
    const [rates, goldUsdPerOz, usdtUsd] = await Promise.all([
      fetchExchangeRates(),
      fetchGoldUsd(),
      fetchUsdtUsd().catch(() => 1.0), // USDT fallback = $1
    ]);

    // Gold per gram (24K pure), in Toman
    const gold24PerGram = (goldUsdPerOz / TROY_OZ_GRAMS) * rates.usdToToman;
    // Gold 18K per gram = 75% purity
    const gold18PerGram = gold24PerGram * 0.75;
    // Mithqal = 4.608g of 24K gold
    const mithqalToman = gold24PerGram * 4.608;

    const result: PriceData = {
      gold18: toman(gold18PerGram),
      gold24: toman(gold24PerGram),
      mithqal: toman(mithqalToman),
      emamiCoin: coinPrice(gold24PerGram, COIN_SPECS.emami),
      baharCoin: coinPrice(gold24PerGram, COIN_SPECS.bahar),
      halfCoin: coinPrice(gold24PerGram, COIN_SPECS.half),
      quarterCoin: coinPrice(gold24PerGram, COIN_SPECS.quarter),
      usd: toman(rates.usdToToman),
      eur: toman(rates.eurToToman),
      gbp: toman(rates.gbpToToman),
      aed: toman(rates.aedToToman),
      usdt: toman(usdtUsd * rates.usdToToman),
      updatedAt: new Date().toLocaleTimeString("fa-IR"),
    };

    cachedData = result;
    logger.info({ goldUsd: goldUsdPerOz, usdToToman: rates.usdToToman }, "Prices fetched");
    return result;
  } catch (err) {
    logger.error({ err }, "Failed to fetch live prices");

    if (cachedData) {
      logger.warn("Returning cached prices");
      return { ...cachedData, updatedAt: cachedData.updatedAt + " (قدیمی)" };
    }

    const na = "خطا در دریافت";
    return {
      gold18: na, gold24: na, mithqal: na,
      emamiCoin: na, baharCoin: na, halfCoin: na, quarterCoin: na,
      usd: na, eur: na, gbp: na, aed: na, usdt: na,
      updatedAt: new Date().toLocaleTimeString("fa-IR"),
    };
  }
}
