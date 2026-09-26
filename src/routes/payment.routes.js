const express = require("express");
const { requireAuth } = require("../auth");
const { paySchema, validate } = require("../validation");
const service = require("../services/payment.service");

const router = express.Router();

router.use(requireAuth);

router.post("/", async (req, res, next) => {
  try {
    const key = req.headers["idempotency-key"];

    if (!key || String(key).length < 8 || String(key).length > 255) {
      return res.status(400).json({
        error: "Idempotency-Key header is required and must be 8-255 characters"
      });
    }

    const body = validate(paySchema, req.body);

    const result = await service.createPayment({
      senderUserId: req.user.sub,
      receiverUpiId: body.receiverUpiId,
      amountRupees: body.amountRupees,
      idempotencyKey: String(key)
    });

    res.status(result.replayed ? 200 : 201).json(result);
  } catch (e) { next(e); }
});

router.get("/:id", async (req, res, next) => {
  try {
    res.json(await service.getPayment(req.params.id, req.user.sub));
  } catch (e) { next(e); }
});

module.exports = router;
