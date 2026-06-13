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
  ton: string;
  hmstr: string;
  dogs: string;
  updatedAt: string;
}

// --- helpers ---

function toman(amount: number): string {
  return Math.round(amount).toLocaleString("fa-IR") + " تومان";
}

function usd(amount: number): string {
  if (amount >= 1) return "$" + amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  return "$" + amount.toFixed(6);
}

const TROY_OZ_GRAMS = 31.1035;

const COIN_SPECS = {
  emami:   { grams: 8.133, purity: 22 / 24, premium: 0.17 },
  bahar:   { grams: 8.133, purity: 22 / 24, premium: 0.12 },
  half:    { grams: 4.068, purity: 22 / 24, premium: 0.14 },
  quarter: { grams: 2.034, purity: 22 / 24, premium: 0.16 },
};

function coinPrice(goldPerGramPure: number, spec: { grams: number; purity: number; premium: number }): string {
  return toman(spec.grams * spec.purity * goldPerGramPure * (1 + spec.premium));
}

// --- data fetching ---

interface Rates {
  usdToToman: number;
  eurToToman: number;
  gbpToToman: number;
  aedToToman: number;
}

async function fetchExchangeRates(): Promise<Rates> {
  const { data } = await axios.get("https://open.er-api.com/v6/latest/USD", { timeout: 8000 });
  const r = data.rates;
  const usdToToman = r.IRR / 10;
  return {
    usdToToman,
    eurToToman: usdToToman / r.EUR,
    gbpToToman: usdToToman / r.GBP,
    aedToToman: usdToToman / r.AED,
  };
}

async function fetchGoldUsd(): Promise<number> {
  const { data } = await axios.get("https://api.coinbase.com/v2/prices/XAU-USD/spot", { timeout: 8000 });
  return parseFloat(data.data.amount);
}

interface CryptoRates {
  usdt: number;
  ton: number;
  hmstr: number;
  dogs: number;
}

async function fetchCryptoUsd(): Promise<CryptoRates> {
  const { data } = await axios.get(
    "https://api.coingecko.com/api/v3/simple/price?ids=tether,the-open-network,hamster-kombat,dogs&vs_currencies=usd",
    { timeout: 8000 }
  );
  return {
    usdt: data["tether"]?.usd ?? 1,
    ton:  data["the-open-network"]?.usd ?? 0,
    hmstr: data["hamster-kombat"]?.usd ?? 0,
    dogs: data["dogs"]?.usd ?? 0,
  };
}

// --- main export ---

let cachedData: PriceData | null = null;

export async function fetchLivePrices(): Promise<PriceData> {
  try {
    const [rates, goldUsdPerOz, crypto] = await Promise.all([
      fetchExchangeRates(),
      fetchGoldUsd(),
      fetchCryptoUsd().catch(() => ({ usdt: 1, ton: 0, hmstr: 0, dogs: 0 })),
    ]);

    const gold24PerGram = (goldUsdPerOz / TROY_OZ_GRAMS) * rates.usdToToman;
    const gold18PerGram = gold24PerGram * 0.75;
    const mithqalToman  = gold24PerGram * 4.608;

    const result: PriceData = {
      gold18:      toman(gold18PerGram),
      gold24:      toman(gold24PerGram),
      mithqal:     toman(mithqalToman),
      emamiCoin:   coinPrice(gold24PerGram, COIN_SPECS.emami),
      baharCoin:   coinPrice(gold24PerGram, COIN_SPECS.bahar),
      halfCoin:    coinPrice(gold24PerGram, COIN_SPECS.half),
      quarterCoin: coinPrice(gold24PerGram, COIN_SPECS.quarter),
      usd:  toman(rates.usdToToman),
      eur:  toman(rates.eurToToman),
      gbp:  toman(rates.gbpToToman),
      aed:  toman(rates.aedToToman),
      usdt: toman(crypto.usdt * rates.usdToToman),
      ton:  `${usd(crypto.ton)} | ${toman(crypto.ton * rates.usdToToman)}`,
      hmstr:`${usd(crypto.hmstr)} | ${toman(crypto.hmstr * rates.usdToToman)}`,
      dogs: `${usd(crypto.dogs)} | ${toman(crypto.dogs * rates.usdToToman)}`,
      updatedAt: new Date().toLocaleTimeString("fa-IR"),
    };

    cachedData = result;
    logger.info({ goldUsd: goldUsdPerOz, usdToToman: rates.usdToToman, tonUsd: crypto.ton }, "Prices fetched");
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
      ton: na, hmstr: na, dogs: na,
      updatedAt: new Date().toLocaleTimeString("fa-IR"),
    };
  }
}
