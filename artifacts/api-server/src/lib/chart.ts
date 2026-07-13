import axios from "axios";

export type ChartAsset = "btc" | "eth" | "ton" | "gold";
export type ChartPeriod = "7" | "30" | "365" | "1095";

const ASSET_NAMES: Record<ChartAsset, string> = {
  btc: "بیت‌کوین (BTC)",
  eth: "اتریوم (ETH)",
  ton: "تون (TON)",
  gold: "طلا (XAU)",
};

const PERIOD_LABELS: Record<ChartPeriod, string> = {
  "7": "۷ روز گذشته",
  "30": "۱ ماه گذشته",
  "365": "۱ سال گذشته",
  "1095": "۳ سال گذشته",
};

const MAX_POINTS = 40;

const COINGECKO_IDS: Record<string, string> = {
  btc: "bitcoin",
  eth: "ethereum",
  ton: "the-open-network",
  gold: "pax-gold",
};

function formatLabel(ts: number, period: ChartPeriod): string {
  const d = new Date(ts);
  if (period === "7" || period === "30") {
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }
  if (period === "365") {
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return months[d.getMonth()]!;
  }
  // 1095 — year/month
  return `${d.getFullYear()}/${d.getMonth() + 1}`;
}

async function fetchHistoricalPrices(
  asset: ChartAsset,
  period: ChartPeriod
): Promise<{ labels: string[]; prices: number[] }> {
  const coinId = COINGECKO_IDS[asset];
  const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart`;
  const resp = await axios.get<{ prices: [number, number][] }>(url, {
    params: { vs_currency: "usd", days: period },
    timeout: 15_000,
    headers: { Accept: "application/json" },
  });

  const raw = resp.data.prices;
  const step = Math.max(1, Math.floor(raw.length / MAX_POINTS));
  const sampled = raw.filter((_, i) => i % step === 0);

  const labels = sampled.map(([ts]) => formatLabel(ts, period));
  const prices = sampled.map(([, p]) => Math.round(p * 100) / 100);
  return { labels, prices };
}

export async function generateChartBuffer(
  asset: ChartAsset,
  period: ChartPeriod
): Promise<{ buffer: Buffer; caption: string }> {
  const { labels, prices } = await fetchHistoricalPrices(asset, period);

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
  const chartUrl = `https://quickchart.io/chart?c=${encoded}&width=700&height=380&backgroundColor=white`;

  const imgResp = await axios.get<Buffer>(chartUrl, {
    responseType: "arraybuffer",
    timeout: 15_000,
  });

  const first = prices[0] ?? 0;
  const last = prices[prices.length - 1] ?? 0;
  const changePct = first > 0 ? (((last - first) / first) * 100).toFixed(2) : "0";
  const arrow = isUp ? "📈" : "📉";

  const caption =
    `${arrow} *${ASSET_NAMES[asset]}*\n` +
    `دوره: ${PERIOD_LABELS[period]}\n\n` +
    `قیمت ابتدا: $${first.toLocaleString()}\n` +
    `قیمت اکنون: $${last.toLocaleString()}\n` +
    `تغییر: ${changePct}%`;

  return { buffer: Buffer.from(imgResp.data), caption };
}
