const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

const authRoutes = require("./routes/auth.routes");
const walletRoutes = require("./routes/wallet.routes");
const paymentRoutes = require("./routes/payment.routes");

const app = express();

app.disable("x-powered-by");
app.use(cors());
app.use(express.json({ limit: "100kb" }));

app.use(rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false
}));

app.get("/health", (req, res) => {
  res.json({ status: "UP", service: "amanpay-api" });
});

app.use("/api/auth", authRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/payments", paymentRoutes);

app.use((err, req, res, next) => {
  console.error(err);

  res.status(err.statusCode || 500).json({
    error: err.statusCode ? err.message : "Internal server error",
    ...(err.details ? { details: err.details } : {})
  });
});

module.exports = app;
