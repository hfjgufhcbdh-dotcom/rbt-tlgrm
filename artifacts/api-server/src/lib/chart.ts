import axios from "axios";

// ── Types ──────────────────────────────────────────────────────────────────

export type ChartCategory =
  | "gold"
  | "coin"
  | "currency"
  | "crypto"
  | "parsian"
  | "globalgold"
  | "meltedgold";

export type ChartPeriod = "7" | "30" | "90" | "180" | "365" | "1095" | "max";

export interface ChartAssetDef {
  key: string;
  label: string;
  emoji: string;
}

// ── Category & asset metadata ──────────────────────────────────────────────

export const CHART_CATEGORIES: Record<ChartCategory, { label: string; emoji: string }> = {
  gold:       { label: "طلا",          emoji: "🥇" },
  coin:       { label: "سکه",          emoji: "🪙" },
  currency:   { label: "ارز",          emoji: "💵" },
  crypto:     { label: "ارز دیجیتال", emoji: "💎" },
  parsian:    { label: "سکه پارسیان", emoji: "🏦" },
  globalgold: { label: "طلای جهانی",  emoji: "🌍" },
  meltedgold: { label: "طلای آب‌شده", emoji: "🔥" },
};

export const CHART_ASSETS: Record<ChartCategory, ChartAssetDef[]> = {
  gold: [
    { key: "gold18",  label: "طلای ۱۸ عیار (هر گرم)", emoji: "🔸" },
    { key: "gold24",  label: "طلای ۲۴ عیار (هر گرم)", emoji: "🔹" },
    { key: "mithqal", label: "مثقال طلا",              emoji: "⚜️" },
  ],
  coin: [
    { key: "emami",   label: "سکه امامی",   emoji: "🏅" },
    { key: "bahar",   label: "بهار آزادی",  emoji: "🪙" },
    { key: "half",    label: "نیم سکه",     emoji: "🔸" },
    { key: "quarter", label: "ربع سکه",     emoji: "🔹" },
  ],
  currency: [
    { key: "usd", label: "دلار آمریکا",      emoji: "🇺🇸" },
    { key: "eur", label: "یورو",             emoji: "🇪🇺" },
    { key: "gbp", label: "پوند انگلیس",     emoji: "🇬🇧" },
    { key: "aed", label: "درهم امارات",     emoji: "🇦🇪" },
    { key: "try", label: "لیر ترکیه",       emoji: "🇹🇷" },
    { key: "rub", label: "روبل روسیه",      emoji: "🇷🇺" },
    { key: "cny", label: "یوان چین",        emoji: "🇨🇳" },
    { key: "jpy", label: "ین ژاپن",         emoji: "🇯🇵" },
    { key: "inr", label: "روپیه هند",       emoji: "🇮🇳" },
    { key: "sar", label: "ریال عربستان",    emoji: "🇸🇦" },
    { key: "iqd", label: "دینار عراق",      emoji: "🇮🇶" },
    { key: "pkr", label: "روپیه پاکستان",  emoji: "🇵🇰" },
    { key: "afn", label: "افغانی",           emoji: "🇦🇫" },
  ],
  crypto: [
    { key: "btc",  label: "بیت‌کوین (BTC)", emoji: "₿"  },
    { key: "eth",  label: "اتریوم (ETH)",   emoji: "🔷" },
    { key: "ton",  label: "تون (TON)",       emoji: "💎" },
    { key: "usdt", label: "تتر (USDT)",      emoji: "₮"  },
    { key: "hmstr",label: "همستر (HMSTR)",  emoji: "🐹" },
    { key: "dogs", label: "داگز (DOGS)",     emoji: "🐶" },
    { key: "not",  label: "نات‌کوین (NOT)",  emoji: "🔴" },
  ],
  parsian: [
    { key: "p100", label: "۱۰۰ سوت (۰.۱ g)",  emoji: "🔹" },
    { key: "p250", label: "۲۵۰ سوت (۰.۲۵ g)", emoji: "🔸" },
    { key: "p500", label: "۵۰۰ سوت (۰.۵ g)",  emoji: "🔶" },
    { key: "p1g",  label: "۱ گرم",             emoji: "🥇" },
    { key: "p2g",  label: "۲ گرم",             emoji: "🏆" },
  ],
  globalgold: [
    { key: "xau", label: "اونس طلا (XAU/USD)", emoji: "🌍" },
  ],
  meltedgold: [
    { key: "gram", label: "هر گرم (تومان)", emoji: "🔥" },
  ],
};

export const PERIOD_LABELS: Record<ChartPeriod, string> = {
  "7":    "۷ روز",
  "30":   "۳۰ روز",
  "90":   "۳ ماه",
  "180":  "۶ ماه",
  "365":  "۱ سال",
  "1095": "۳ سال",
  "max":  "حداکثر",
};

// ── Internal constants ─────────────────────────────────────────────────────

const TROY_OZ_GRAMS = 31.1035;
const MAX_POINTS = 40;

interface PeriodConfig { days: number; samples: number; cgDays: string }

const PERIOD_CONFIG: Record<ChartPeriod, PeriodConfig> = {
  "7":    { days: 7,    samples: 7,  cgDays: "7"    },
  "30":   { days: 30,   samples: 30, cgDays: "30"   },
  "90":   { days: 90,   samples: 30, cgDays: "90"   },
  "180":  { days: 180,  samples: 30, cgDays: "180"  },
  "365":  { days: 365,  samples: 26, cgDays: "365"  },
  "1095": { days: 1095, samples: 36, cgDays: "1095" },
  "max":  { days: 1825, samples: 40, cgDays: "max"  },
};

const COINGECKO_IDS: Record<string, string> = {
  btc:  "bitcoin",
  eth:  "ethereum",
  ton:  "the-open-network",
  hmstr:"hamster-kombat",
  dogs: "dogs",
  not:  "notcoin",
  usdt: "tether",
  xau:  "pax-gold",
};

const COIN_SPECS: Record<string, { grams: number; purity: number; premium: number }> = {
  emami:   { grams: 8.133, purity: 22 / 24, premium: 0.17 },
  bahar:   { grams: 8.133, purity: 22 / 24, premium: 0.12 },
  half:    { grams: 4.068, purity: 22 / 24, premium: 0.14 },
  quarter: { grams: 2.034, purity: 22 / 24, premium: 0.16 },
};

const PARSIAN_WEIGHTS: Record<string, number> = {
  p100: 0.100, p250: 0.250, p500: 0.500, p1g: 1.000, p2g: 2.000,
};

// ── Date helpers ───────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  return d.toISOString().split("T")[0]!;
}

function generateDates(days: number, count: number): string[] {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - Math.round((days / Math.max(count - 1, 1)) * (count - 1 - i)));
    return toDateStr(d);
  });
}

function formatLabel(dateStr: string, period: ChartPeriod): string {
  const d = new Date(dateStr);
  const m = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getMonth()]!;
  if (period === "7" || period === "30") return `${d.getMonth() + 1}/${d.getDate()}`;
  if (period === "90" || period === "180" || period === "365") return `${m} ${d.getDate()}`;
  return `${m} '${String(d.getFullYear()).slice(2)}`;
}

// ── CoinGecko ─────────────────────────────────────────────────────────────

const CG_HEADERS = { "User-Agent": "Mozilla/5.0 (compatible; PriceBot/1.0)" };

async function fetchCoinGeckoSeries(
  coinId: string,
  period: ChartPeriod,
): Promise<{ labels: string[]; prices: number[] }> {
  const { cgDays } = PERIOD_CONFIG[period];
  const { data } = await axios.get<{ prices: [number, number][] }>(
    `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart`,
    { params: { vs_currency: "usd", days: cgDays }, timeout: 15_000, headers: CG_HEADERS },
  );
  const raw = data.prices;
  const step = Math.max(1, Math.floor(raw.length / MAX_POINTS));
  const sampled = raw.filter((_, i) => i % step === 0);
  return {
    labels: sampled.map(([ts]) => formatLabel(toDateStr(new Date(ts)), period)),
    prices: sampled.map(([, p]) => p),
  };
}

// Fetch gold USD per troy oz history from CoinGecko, indexed by date string
async function fetchGoldUsdByDate(period: ChartPeriod): Promise<Map<string, number>> {
  const { cgDays } = PERIOD_CONFIG[period];
  const { data } = await axios.get<{ prices: [number, number][] }>(
    `https://api.coingecko.com/api/v3/coins/pax-gold/market_chart`,
    { params: { vs_currency: "usd", days: cgDays }, timeout: 15_000, headers: CG_HEADERS },
  );
  const map = new Map<string, number>();
  for (const [ts, price] of data.prices) map.set(toDateStr(new Date(ts)), price);
  return map;
}

function nearestGoldPrice(date: string, goldByDate: Map<string, number>): number {
  const base = new Date(date);
  for (let delta = 0; delta <= 4; delta++) {
    for (const sign of [0, -1, 1]) {
      if (delta === 0 && sign !== 0) continue;
      const d = new Date(base);
      d.setDate(d.getDate() + sign * delta);
      const p = goldByDate.get(toDateStr(d));
      if (p) return p;
    }
  }
  return 0;
}

// ── fawazahmed0 Currency API ───────────────────────────────────────────────
// Returns rates relative to USD: { irr: 840000, eur: 0.92, ... }

async function fetchRatesForDate(date: string): Promise<Record<string, number> | null> {
  const primary = `https://${date}.currency-api.pages.dev/v1/currencies/usd.min.json`;
  const fallback = `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${date}/v1/currencies/usd.min.json`;
  for (const url of [primary, fallback]) {
    try {
      const { data } = await axios.get(url, { timeout: 8_000 });
      return (data as { usd: Record<string, number> }).usd;
    } catch {
      // try fallback
    }
  }
  return null;
}

// ── Toman-based series builders ────────────────────────────────────────────

function scaleToman(rawPrices: number[]): { scaled: number[]; unitLabel: string; divisor: number } {
  const mx = Math.max(...rawPrices);
  if (mx >= 1_000_000_000) return { scaled: rawPrices.map(p => parseFloat((p / 1e9).toFixed(3))), unitLabel: "میلیارد تومان", divisor: 1e9 };
  if (mx >= 1_000_000)     return { scaled: rawPrices.map(p => parseFloat((p / 1e6).toFixed(2))), unitLabel: "میلیون تومان",  divisor: 1e6 };
  if (mx >= 1_000)         return { scaled: rawPrices.map(p => parseFloat((p / 1e3).toFixed(1))), unitLabel: "هزار تومان",    divisor: 1e3 };
  return { scaled: rawPrices, unitLabel: "تومان", divisor: 1 };
}

async function buildGoldBasedSeries(
  category: "gold" | "coin" | "parsian" | "meltedgold",
  assetKey: string,
  period: ChartPeriod,
): Promise<{ labels: string[]; prices: number[]; unit: "toman" }> {
  const { days, samples } = PERIOD_CONFIG[period];
  const dates = generateDates(days, samples);

  const [goldByDate, rateResults] = await Promise.all([
    fetchGoldUsdByDate(period),
    Promise.all(dates.map(d => fetchRatesForDate(d))),
  ]);

  const labels: string[] = [];
  const prices: number[] = [];

  for (let i = 0; i < dates.length; i++) {
    const date = dates[i]!;
    const rates = rateResults[i];
    if (!rates) continue;
    const irr = rates["irr"] ?? 0;
    if (irr === 0) continue;
    const usdToToman = irr / 10;

    const goldUsdPerOz = nearestGoldPrice(date, goldByDate);
    if (goldUsdPerOz === 0) continue;

    const goldUsdPerGram = goldUsdPerOz / TROY_OZ_GRAMS;
    const gold24PerGramToman = goldUsdPerGram * usdToToman;
    const gold18PerGramToman = gold24PerGramToman * 0.75;

    let price = 0;
    if (category === "gold") {
      if (assetKey === "gold18") price = gold18PerGramToman;
      else if (assetKey === "gold24") price = gold24PerGramToman;
      else if (assetKey === "mithqal") price = gold24PerGramToman * 4.608;
    } else if (category === "coin") {
      const spec = COIN_SPECS[assetKey];
      if (!spec) continue;
      price = spec.grams * spec.purity * gold24PerGramToman * (1 + spec.premium);
    } else if (category === "parsian") {
      const w = PARSIAN_WEIGHTS[assetKey] ?? 0;
      price = gold18PerGramToman * w;
    } else if (category === "meltedgold") {
      price = gold24PerGramToman;
    }

    if (price > 0) {
      labels.push(formatLabel(date, period));
      prices.push(Math.round(price));
    }
  }
  return { labels, prices, unit: "toman" };
}

async function buildCurrencySeries(
  assetKey: string,
  period: ChartPeriod,
): Promise<{ labels: string[]; prices: number[]; unit: "toman" }> {
  const { days, samples } = PERIOD_CONFIG[period];
  const dates = generateDates(days, samples);
  const rateResults = await Promise.all(dates.map(d => fetchRatesForDate(d)));

  const labels: string[] = [];
  const prices: number[] = [];

  for (let i = 0; i < dates.length; i++) {
    const date = dates[i]!;
    const rates = rateResults[i];
    if (!rates) continue;
    const irr = rates["irr"] ?? 0;
    if (irr === 0) continue;
    const usdToToman = irr / 10;

    let price: number;
    if (assetKey === "usd") {
      price = usdToToman;
    } else {
      const rate = rates[assetKey] ?? 0;
      if (rate === 0) continue;
      price = usdToToman / rate;
    }

    if (price > 0) {
      labels.push(formatLabel(date, period));
      prices.push(Math.round(price));
    }
  }
  return { labels, prices, unit: "toman" };
}

// ── Caption formatting ─────────────────────────────────────────────────────

function fmtUsd(v: number): string {
  if (v >= 1) return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
  return `$${v.toFixed(6)}`;
}

function fmtToman(v: number): string {
  return `${Math.round(v).toLocaleString("fa-IR")} تومان`;
}

// ── Main export ────────────────────────────────────────────────────────────

export async function generateChartBuffer(
  category: ChartCategory,
  assetKey: string,
  period: ChartPeriod,
): Promise<{ buffer: Buffer; caption: string }> {
  let labels: string[];
  let rawPrices: number[];
  let isUsd = false;

  if (category === "crypto") {
    const coinId = COINGECKO_IDS[assetKey];
    if (!coinId) throw new Error(`Unknown crypto: ${assetKey}`);
    const s = await fetchCoinGeckoSeries(coinId, period);
    labels = s.labels; rawPrices = s.prices; isUsd = true;
  } else if (category === "globalgold") {
    const s = await fetchCoinGeckoSeries("pax-gold", period);
    labels = s.labels; rawPrices = s.prices; isUsd = true;
  } else if (category === "currency") {
    const s = await buildCurrencySeries(assetKey, period);
    labels = s.labels; rawPrices = s.prices;
  } else {
    const s = await buildGoldBasedSeries(
      category as "gold" | "coin" | "parsian" | "meltedgold",
      assetKey,
      period,
    );
    labels = s.labels; rawPrices = s.prices;
  }

  if (rawPrices.length === 0) throw new Error("No data available for this asset/period");

  const assetDef = CHART_ASSETS[category]?.find(a => a.key === assetKey);
  const assetLabel = assetDef ? `${assetDef.emoji} ${assetDef.label}` : assetKey;
  const catLabel = CHART_CATEGORIES[category].label;
  const periodLabel = PERIOD_LABELS[period];

  // Scale toman values for readable y-axis
  let chartPrices = rawPrices;
  let yAxisLabel = "USD";
  let scaleDivisor = 1;
  if (!isUsd) {
    const scaled = scaleToman(rawPrices);
    chartPrices = scaled.scaled;
    yAxisLabel = scaled.unitLabel;
    scaleDivisor = scaled.divisor;
  }

  const first = rawPrices[0]!;
  const last  = rawPrices[rawPrices.length - 1]!;
  const isUp  = last >= first;
  const color     = isUp ? "rgb(34,197,94)"       : "rgb(239,68,68)";
  const fillColor = isUp ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)";
  const arrow = isUp ? "📈" : "📉";
  const changePct = first > 0 ? (((last - first) / first) * 100).toFixed(2) : "0.00";
  const changeSign = isUp ? "+" : "";

  const chartTitle = `${assetDef?.label ?? assetKey} — ${periodLabel} (${yAxisLabel})`;

  const chartConfig = {
    type: "line",
    data: {
      labels,
      datasets: [{
        data: chartPrices,
        borderColor: color,
        backgroundColor: fillColor,
        borderWidth: 2,
        pointRadius: chartPrices.length > 25 ? 1 : 3,
        fill: true,
        tension: 0.3,
      }],
    },
    options: {
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: chartTitle,
          font: { size: 13, weight: "bold" },
          color: "#1f2937",
          padding: { bottom: 10 },
        },
      },
      scales: {
        x: {
          ticks: { font: { size: 9 }, color: "#6b7280", maxTicksLimit: 10, maxRotation: 30 },
          grid: { color: "rgba(0,0,0,0.05)" },
        },
        y: {
          ticks: { font: { size: 9 }, color: "#6b7280" },
          grid: { color: "rgba(0,0,0,0.05)" },
        },
      },
      elements: { line: { borderCapStyle: "round" } },
    },
  };

  const chartUrl =
    `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}` +
    `&width=720&height=400&backgroundColor=white`;

  const imgResp = await axios.get<Buffer>(chartUrl, {
    responseType: "arraybuffer",
    timeout: 20_000,
  });

  const caption =
    `${arrow} *${catLabel} › ${assetDef?.label ?? assetKey}*\n` +
    `📅 دوره: ${periodLabel}\n\n` +
    `قیمت ابتدا: ${isUsd ? fmtUsd(first) : fmtToman(first)}\n` +
    `قیمت اکنون: ${isUsd ? fmtUsd(last) : fmtToman(last)}\n` +
    `تغییر: ${changeSign}${changePct}%`;

  return { buffer: Buffer.from(imgResp.data), caption };
}
