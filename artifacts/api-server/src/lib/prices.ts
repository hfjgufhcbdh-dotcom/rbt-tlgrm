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
  parsian100: string;
  parsian250: string;
  parsian500: string;
  parsian1g: string;
  parsian2g: string;
  usd: string;
  eur: string;
  gbp: string;
  aed: string;
  afn: string;
  iqd: string;
  tryL: string;
  pkr: string;
  rub: string;
  sar: string;
  cny: string;
  jpy: string;
  inr: string;
  usdt: string;
  ton: string;
  hmstr: string;
  dogs: string;
  star: string;
  not: string;
  btc: string;
  eth: string;
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
  afnToToman: number;
  iqdToToman: number;
  tryToToman: number;
  pkrToToman: number;
  rubToToman: number;
  sarToToman: number;
  cnyToToman: number;
  jpyToToman: number;
  inrToToman: number;
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
    afnToToman: usdToToman / r.AFN,
    iqdToToman: usdToToman / r.IQD,
    tryToToman: usdToToman / r.TRY,
    pkrToToman: usdToToman / r.PKR,
    rubToToman: usdToToman / r.RUB,
    sarToToman: usdToToman / r.SAR,
    cnyToToman: usdToToman / r.CNY,
    jpyToToman: usdToToman / r.JPY,
    inrToToman: usdToToman / r.INR,
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
  star: number;
  not: number;
  btc: number;
  eth: number;
}

const CG_HEADERS = { "User-Agent": "Mozilla/5.0 (compatible; PriceBot/1.0)" };

export type GlobalCryptoPrice = {
  usd: number;
  usd_24h_change: number | null;
};

export type GlobalCryptoPrices = Record<string, GlobalCryptoPrice>;

const GLOBAL_COIN_IDS = [
  "bitcoin",
  "ethereum",
  "tether",
  "tron",
  "solana",
  "binancecoin",
  "ripple",
  "the-open-network",
  "dogecoin",
] as const;

async function fetchCryptoUsd(): Promise<CryptoRates> {
  const { data } = await axios.get(
    "https://api.coingecko.com/api/v3/simple/price?ids=tether,the-open-network,hamster-kombat,dogs,star,notcoin,bitcoin,ethereum&vs_currencies=usd",
    { timeout: 8000, headers: CG_HEADERS }
  );
  return {
    usdt:  data["tether"]?.usd ?? 1,
    ton:   data["the-open-network"]?.usd ?? 0,
    hmstr: data["hamster-kombat"]?.usd ?? 0,
    dogs:  data["dogs"]?.usd ?? 0,
    star:  data["star"]?.usd ?? 0,
    not:   data["notcoin"]?.usd ?? 0,
    btc:   data["bitcoin"]?.usd ?? 0,
    eth:   data["ethereum"]?.usd ?? 0,
  };
}

export async function fetchGlobalPrices(): Promise<GlobalCryptoPrices> {
  const { data } = await axios.get<Record<string, { usd?: number; usd_24h_change?: number }>>(
    "https://api.coingecko.com/api/v3/simple/price",
    {
      params: {
        ids: GLOBAL_COIN_IDS.join(","),
        vs_currencies: "usd",
        include_24hr_change: "true",
      },
      timeout: 8000,
      headers: CG_HEADERS,
    },
  );

  return Object.fromEntries(
    GLOBAL_COIN_IDS.map((coinId) => {
      const value = data[coinId];
      if (typeof value?.usd !== "number" || !Number.isFinite(value.usd)) {
        throw new Error(`CoinGecko returned no USD price for ${coinId}`);
      }

      return [
        coinId,
        {
          usd: value.usd,
          usd_24h_change:
            typeof value.usd_24h_change === "number" && Number.isFinite(value.usd_24h_change)
              ? value.usd_24h_change
              : null,
        },
      ];
    }),
  );
}

export type IranianCryptoPriceKey = "USDT" | "BTC" | "ETH" | "TRX" | "SOL" | "TON";
export type IranianCryptoPrices = Record<IranianCryptoPriceKey, number>;

type NobitexMarket = {
  lastTradePrice?: string | number;
};

const IRANIAN_MARKETS: Record<IranianCryptoPriceKey, string> = {
  USDT: "USDTIRT",
  BTC: "BTCIRT",
  ETH: "ETHIRT",
  TRX: "TRXIRT",
  SOL: "SOLIRT",
  TON: "TONIRT",
};

export async function fetchIranianPrices(): Promise<IranianCryptoPrices> {
  const { data } = await axios.get<Record<string, NobitexMarket>>(
    "https://api.nobitex.ir/v2/orderbook/all",
    {
      timeout: 8000,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; PriceBot/1.0)" },
    },
  );

  return Object.fromEntries(
    Object.entries(IRANIAN_MARKETS).map(([symbol, market]) => {
      const rawPrice = data[market]?.lastTradePrice;
      const price = typeof rawPrice === "number" ? rawPrice : Number(rawPrice);

      if (!Number.isFinite(price) || price < 0) {
        throw new Error(`Nobitex returned no valid price for ${market}`);
      }

      return [symbol, price];
    }),
  ) as IranianCryptoPrices;
}

// --- raw numeric data for internal use (charts, collectors) ---

export interface RawPrices {
  goldUsdPerOz: number;
  gold24PerGramToman: number;
  usdToToman: number;
  btcUsd: number;
  ethUsd: number;
  tonUsd: number;
}

let cachedRaw: RawPrices | null = null;

export async function fetchRawPrices(): Promise<RawPrices | null> {
  return cachedRaw;
}

// --- main export ---

let cachedData: PriceData | null = null;

export async function fetchLivePrices(): Promise<PriceData> {
  try {
    const [rates, goldUsdPerOz, crypto] = await Promise.all([
      fetchExchangeRates(),
      fetchGoldUsd(),
      fetchCryptoUsd().catch(() => ({ usdt: 1, ton: 0, hmstr: 0, dogs: 0, star: 0, not: 0, btc: 0, eth: 0 })),
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
      parsian100:  toman(gold18PerGram * 0.100),
      parsian250:  toman(gold18PerGram * 0.250),
      parsian500:  toman(gold18PerGram * 0.500),
      parsian1g:   toman(gold18PerGram * 1.000),
      parsian2g:   toman(gold18PerGram * 2.000),
      usd:  toman(rates.usdToToman),
      eur:  toman(rates.eurToToman),
      gbp:  toman(rates.gbpToToman),
      aed:  toman(rates.aedToToman),
      afn:  toman(rates.afnToToman),
      iqd:  toman(rates.iqdToToman),
      tryL: toman(rates.tryToToman),
      pkr:  toman(rates.pkrToToman),
      rub:  toman(rates.rubToToman),
      sar:  toman(rates.sarToToman),
      cny:  toman(rates.cnyToToman),
      jpy:  toman(rates.jpyToToman),
      inr:  toman(rates.inrToToman),
      usdt: toman(crypto.usdt * rates.usdToToman),
      ton:  `${usd(crypto.ton)} | ${toman(crypto.ton * rates.usdToToman)}`,
      hmstr:`${usd(crypto.hmstr)} | ${toman(crypto.hmstr * rates.usdToToman)}`,
      dogs: `${usd(crypto.dogs)} | ${toman(crypto.dogs * rates.usdToToman)}`,
      star: `${usd(crypto.star)} | ${toman(crypto.star * rates.usdToToman)}`,
      not:  `${usd(crypto.not)} | ${toman(crypto.not * rates.usdToToman)}`,
      btc:  `${usd(crypto.btc)} | ${toman(crypto.btc * rates.usdToToman)}`,
      eth:  `${usd(crypto.eth)} | ${toman(crypto.eth * rates.usdToToman)}`,
      updatedAt: new Date().toLocaleTimeString("fa-IR"),
    };

    cachedData = result;
    cachedRaw = {
      goldUsdPerOz,
      gold24PerGramToman: gold24PerGram,
      usdToToman: rates.usdToToman,
      btcUsd: crypto.btc,
      ethUsd: crypto.eth,
      tonUsd: crypto.ton,
    };
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
      parsian100: na, parsian250: na, parsian500: na, parsian1g: na, parsian2g: na,
      usd: na, eur: na, gbp: na, aed: na, afn: na,
      iqd: na, tryL: na, pkr: na, rub: na, sar: na, cny: na, jpy: na, inr: na,
      usdt: na,
      ton: na, hmstr: na, dogs: na, star: na, not: na, btc: na, eth: na,
      updatedAt: new Date().toLocaleTimeString("fa-IR"),
    };
  }
}
