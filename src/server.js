const app = require("./app");
const { port } = require("./config");
const { pool } = require("./db");
const redis = require("./redis");
const { producer } = require("./kafka");
const { publishOutboxBatch } = require("./services/payment.service");

async function start() {
  await pool.query("SELECT 1");
  await redis.ping();
  await producer.connect();

  const server = app.listen(port, () => {
    console.log(`AmanPay API running on http://localhost:${port}`);
  });

  // Outbox publisher. In production, run this as a separate worker/service.
  const interval = setInterval(async () => {
    try {
      const count = await publishOutboxBatch();
      if (count) console.log(`Published ${count} outbox event(s)`);
    } catch (err) {
      console.error("Outbox publisher error:", err.message);
    }
  }, 1000);

  async function shutdown(signal) {
    console.log(`Received ${signal}, shutting down...`);
    clearInterval(interval);

    await new Promise(resolve => server.close(resolve));
    await producer.disconnect();
    await redis.quit();
    await pool.end();

    process.exit(0);
  }

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

start().catch(err => {
  console.error("Startup failed:", err);
  process.exit(1);
});
