import { Router, type Request, type Response } from "express";
import {
  fetchGlobalPrices,
  fetchIranianPrices,
  fetchLivePrices,
} from "../lib/prices";

const router = Router();

router.get("/prices", async (req, res) => {
  try {
    const prices = await fetchLivePrices();
    res.json(prices);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch prices");
    res.status(500).json({ error: "Failed to fetch prices" });
  }
});

router.get("/global-prices", async (req, res) => {
  try {
    const data = await fetchGlobalPrices();
    res.json({
      success: true,
      source: "CoinGecko",
      currency: "USD",
      data,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch global crypto prices");
    res.status(502).json({
      success: false,
      source: "CoinGecko",
      error: "خطا در دریافت قیمت‌های جهانی از CoinGecko",
    });
  }
});

router.get("/iranian-prices", async (req, res) => {
  try {
    const rialData = await fetchIranianPrices();
    const tomanData = Object.fromEntries(
      Object.entries(rialData).map(([symbol, price]) => [symbol, price / 10]),
    );

    res.json({
      success: true,
      source: "Nobitex",
      rawCurrency: "IRR",
      currency: "TOMAN",
      data: {
        rial: rialData,
        toman: tomanData,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch Iranian crypto prices");
    res.status(502).json({
      success: false,
      source: "Nobitex",
      error: "خطا در دریافت قیمت‌های بازار ایران از نوبیتکس",
    });
  }
});

// دریافت فهرست قیمت زندهٔ رمزارزها
router.get("/list", async (req, res) => {
  try {
    const prices = await fetchLivePrices();

    res.json({
      success: true,
      message: "لیست قیمت‌ها با موفقیت دریافت شد",
      data: [
        { id: 1, name: "Bitcoin", symbol: "BTC", price: prices.btc },
        { id: 2, name: "Ethereum", symbol: "ETH", price: prices.eth },
        { id: 3, name: "Toncoin", symbol: "TON", price: prices.ton },
        { id: 4, name: "Tether", symbol: "USDT", price: prices.usdt },
        { id: 5, name: "Hamster Kombat", symbol: "HMSTR", price: prices.hmstr },
        { id: 6, name: "Dogs", symbol: "DOGS", price: prices.dogs },
        { id: 7, name: "Notcoin", symbol: "NOT", price: prices.not },
      ],
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch crypto list");
    res.status(500).json({
      success: false,
      error: "Failed to fetch crypto list",
    });
  }
});

// این endpoint فقط ورودی را اعتبارسنجی می‌کند و داده‌ای را ذخیره نمی‌کند.
router.post("/add", (req: Request, res: Response) => {
  const { coinName, price } = req.body ?? {};
  const normalizedName = typeof coinName === "string" ? coinName.trim() : "";
  const numericPrice =
    typeof price === "number"
      ? price
      : typeof price === "string" && price.trim() !== ""
        ? Number(price)
        : Number.NaN;

  if (!normalizedName || !Number.isFinite(numericPrice) || numericPrice < 0) {
    res.status(400).json({
      success: false,
      error: "لطفاً نام ارز و قیمت معتبر را ارسال کنید.",
    });
    return;
  }

  res.status(201).json({
    success: true,
    message: `ارز ${normalizedName} با قیمت ${numericPrice} دریافت شد.`,
    data: {
      coinName: normalizedName,
      price: numericPrice,
      persisted: false,
    },
  });
});

export default router;

