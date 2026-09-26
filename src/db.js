const { Pool } = require("pg");
const { databaseUrl } = require("./config");

const pool = new Pool({
  connectionString: databaseUrl,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000 //  pool is trying to connect to the database for 5 seconds before timing out
});

pool.on("error", (err) => {
  console.error("Unexpected PostgreSQL pool error:", err);
});

async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release(); // return back to the pool so that it can be reused by other requests. If we don't release the client, it will lead to connection leaks and eventually exhaust the pool.
  }
}

module.exports = { pool, withTransaction };
