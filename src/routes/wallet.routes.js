const express = require("express");
const { requireAuth } = require("../auth");
const service = require("../services/wallet.service");

const router = express.Router();

router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    res.json(await service.getWallet(req.user.sub));
  } catch (e) { next(e); }
});

router.get("/transactions", async (req, res, next) => {
  try {
    res.json(await service.getTransactions(req.user.sub));
  } catch (e) { next(e); }
});

module.exports = router;
