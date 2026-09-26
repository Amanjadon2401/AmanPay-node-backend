const { pool } = require("../db");
const { paiseToRupeesString } = require("../validation");

async function getWallet(userId) {
  const result = await pool.query(
    `SELECT w.id, w.balance_paise, u.email, u.name,
            LOWER(REPLACE(u.email, '@', '_')) || '@amanpay' AS upi_id
     FROM wallets w
     JOIN users u ON u.id = w.user_id
     WHERE w.user_id = $1`,
    [userId]
  );

  if (!result.rows[0]) {
    const err = new Error("Wallet not found");
    err.statusCode = 404;
    throw err;
  }

  const row = result.rows[0];
  return {
    walletId: row.id,
    name: row.name,
    email: row.email,
    upiId: row.upi_id,
    balanceRupees: paiseToRupeesString(row.balance_paise)
  };
}

async function getTransactions(userId) {
  const result = await pool.query(
    `SELECT
       t.id,
       t.amount_paise,
       t.status,
       t.failure_reason,
       t.created_at,
       t.completed_at,
       su.email AS sender_email,
       ru.email AS receiver_email
     FROM transactions t
     JOIN wallets sw ON sw.id = t.sender_wallet_id
     JOIN users su ON su.id = sw.user_id
     JOIN wallets rw ON rw.id = t.receiver_wallet_id
     JOIN users ru ON ru.id = rw.user_id
     WHERE sw.user_id = $1 OR rw.user_id = $1
     ORDER BY t.created_at DESC
     LIMIT 100`,
    [userId]
  );

  return result.rows.map(row => ({
    id: row.id,
    amountRupees: paiseToRupeesString(row.amount_paise),
    status: row.status,
    failureReason: row.failure_reason,
    sender: row.sender_email,
    receiver: row.receiver_email,
    createdAt: row.created_at,
    completedAt: row.completed_at
  }));
}

module.exports = { getWallet, getTransactions };
