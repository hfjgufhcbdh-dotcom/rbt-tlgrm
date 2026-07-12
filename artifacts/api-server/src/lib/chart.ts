import axios from "axios";

export type ChartAsset = "btc" | "eth" | "ton" | "gold";
export type ChartPeriod = "7" | "30";

const COINGECKO_IDS: Record<string, string> = {
  btc: "bitcoin",
  eth: "ethereum",
  ton: "the-open-network",
};

const ASSET_NAMES: Record<ChartAsset, string> = {
  btc: "بیت‌کوین (BTC)",
  eth: "اتریوم (ETH)",
  ton: "تون (TON)",
  gold: "طلا (XAU/USD)",
};

const PERIOD_LABELS: Record<ChartPeriod, string> = {
  "7": "۷ روز گذشته",
  "30": "۳۰ روز گذشته",
};

async function fetchCryptoPrices(
  coinId: string,
  days: ChartPeriod
): Promise<{ labels: string[]; prices: number[] }> {
  const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart`;
  const resp = await axios.get<{ prices: [number, number][] }>(url, {
    params: { vs_currency: "usd", days },
    timeout: 10_000,
    headers: { Accept: "application/json" },
  });

  const raw = resp.data.prices;
  // downsample to at most 30 data points
  const step = Math.max(1, Math.floor(raw.length / 30));
  const sampled = raw.filter((_, i) => i % step === 0);

  const labels = sampled.map(([ts]) => {
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  });
  const prices = sampled.map(([, p]) => Math.round(p * 100) / 100);
  return { labels, prices };
}

async function fetchGoldPrices(
  days: ChartPeriod
): Promise<{ labels: string[]; prices: number[] }> {
  // Use BTC as a proxy gold source is unavailable; fall back to a simple OHLC endpoint
  // Gold historical via metals-api alternative: use Coinbase XAU-USD if available
  // Fallback: use open.er-api.com — it only gives live rate, not history
  // Best free option: CoinGecko doesn't support XAU. Use paxg (PAX Gold) as proxy.
  const url = `https://api.coingecko.com/api/v3/coins/pax-gold/market_chart`;
  const resp = await axios.get<{ prices: [number, number][] }>(url, {
    params: { vs_currency: "usd", days },
    timeout: 10_000,
    headers: { Accept: "application/json" },
  });

  const raw = resp.data.prices;
  const step = Math.max(1, Math.floor(raw.length / 30));
  const sampled = raw.filter((_, i) => i % step === 0);

  const labels = sampled.map(([ts]) => {
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  });
  const prices = sampled.map(([, p]) => Math.round(p * 100) / 100);
  return { labels, prices };
}

function buildQuickChartUrl(
  labels: string[],
  prices: number[],
  asset: ChartAsset,
  period: ChartPeriod
): string {
  const isUp = prices[prices.length - 1]! >= prices[0]!;
  const color = isUp ? "rgb(34,197,94)" : "rgb(239,68,68)";
  const fillColor = isUp ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)";

  const chartConfig = {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: ASSET_NAMES[asset],
          data: prices,
          borderColor: color,
          backgroundColor: fillColor,
          borderWidth: 2,
          pointRadius: 2,
          fill: true,
          tension: 0.3,
        },
      ],
    },
    options: {
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: `${ASSET_NAMES[asset]} — ${PERIOD_LABELS[period]}`,
          font: { size: 14 },
          color: "#1f2937",
        },
      },
      scales: {
        x: {
          ticks: { font: { size: 10 }, color: "#6b7280", maxTicksLimit: 8 },
          grid: { color: "rgba(0,0,0,0.05)" },
        },
        y: {
          ticks: { font: { size: 10 }, color: "#6b7280" },
          grid: { color: "rgba(0,0,0,0.05)" },
        },
      },
    },
  };

  const encoded = encodeURIComponent(JSON.stringify(chartConfig));
  return `https://quickchart.io/chart?c=${encoded}&width=700&height=380&backgroundColor=white`;
}

export async function generateChartBuffer(
  asset: ChartAsset,
  period: ChartPeriod
): Promise<{ buffer: Buffer; caption: string }> {
  let labels: string[];
  let prices: number[];

  if (asset === "gold") {
    ({ labels, prices } = await fetchGoldPrices(period));
  } else {
    const coinId = COINGECKO_IDS[asset]!;
    ({ labels, prices } = await fetchCryptoPrices(coinId, period));
  }

  const url = buildQuickChartUrl(labels, prices, asset, period);
  const imgResp = await axios.get<Buffer>(url, {
    responseType: "arraybuffer",
    timeout: 15_000,
  });

  const first = prices[0] ?? 0;
  const last = prices[prices.length - 1] ?? 0;
  const changePct = first > 0 ? (((last - first) / first) * 100).toFixed(2) : "0";
  const arrow = last >= first ? "📈" : "📉";

  const caption =
    `${arrow} *${ASSET_NAMES[asset]}*\n` +
    `دوره: ${PERIOD_LABELS[period]}\n\n` +
    `قیمت ابتدا: $${first.toLocaleString()}\n` +
    `قیمت اکنون: $${last.toLocaleString()}\n` +
    `تغییر: ${changePct}%`;

  return { buffer: Buffer.from(imgResp.data), caption };
}
