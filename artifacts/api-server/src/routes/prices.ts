import { Router } from "express";
import { fetchLivePrices } from "../lib/prices";

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

export default router;
