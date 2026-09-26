const express = require("express");
const { registerSchema, loginSchema, validate } = require("../validation");
const service = require("../services/auth.service");

const router = express.Router();

router.post("/register", async (req, res, next) => {
  try {
    const body = validate(registerSchema, req.body);
    const result = await service.register(body);
    res.status(201).json(result);
  } catch (e) { next(e); }
});

router.post("/login", async (req, res, next) => {
  try {
    const body = validate(loginSchema, req.body);
    const result = await service.login(body);
    res.json(result);
  } catch (e) { next(e); }
});

module.exports = router;
