const { withTransaction } = require("../db");
const { publishPaymentEvent } = require("../kafka");
const { rupeesToPaise, paiseToRupeesString } = require("../validation");

async function createPayment({ senderUserId, receiverUpiId, amountRupees, idempotencyKey }) {
  const amountPaise = rupeesToPaise(amountRupees);

  if (amountPaise <= 0n) {
    const err = new Error("Amount must be greater than zero");
    err.statusCode = 400;
    throw err;
  }

  let result;

  await withTransaction(async (client) => {
    // If the same idempotency key was already used, return the original result.
    const existing = await client.query(
      `SELECT id, status, amount_paise, failure_reason, created_at, completed_at
       FROM transactions
       WHERE idempotency_key = $1`,
      [idempotencyKey]
    );

    if (existing.rows[0]) {
      result = {
        replayed: true,
        transaction: formatTransaction(existing.rows[0])
      };
      return;
    }

    const senderLookup = await client.query(
      `SELECT w.id, w.balance_paise, u.email
       FROM wallets w
       JOIN users u ON u.id = w.user_id
       WHERE w.user_id = $1`,
      [senderUserId]
    );

    if (!senderLookup.rows[0]) {
      const err = new Error("Sender wallet not found");
      err.statusCode = 404;
      throw err;
    }

    const receiverLookup = await client.query(
      `SELECT w.id, w.balance_paise, u.email
       FROM wallets w
       JOIN users u ON u.id = w.user_id
       WHERE LOWER(REPLACE(u.email, '@', '_')) || '@amanpay' = LOWER($1)`,
      [receiverUpiId]
    );

    if (!receiverLookup.rows[0]) {
      const err = new Error("Receiver UPI ID not found");
      err.statusCode = 404;
      throw err;
    }

    const senderCandidate = senderLookup.rows[0];
    const receiverCandidate = receiverLookup.rows[0];

    if (senderCandidate.id === receiverCandidate.id) {
      const err = new Error("Cannot pay yourself");
      err.statusCode = 400;
      throw err;
    }

    // Always lock wallets in UUID order. This prevents a deadlock when
    // two payments happen concurrently in opposite directions (A -> B and B -> A).
    const walletIds = [senderCandidate.id, receiverCandidate.id].sort();

    const lockedWalletsResult = await client.query(
      `SELECT w.id, w.balance_paise, u.email
       FROM wallets w
       JOIN users u ON u.id = w.user_id
       WHERE w.id = ANY($1::uuid[])
       ORDER BY w.id
       FOR UPDATE`,
      [walletIds]
    );

    const walletById = new Map(
      lockedWalletsResult.rows.map(wallet => [wallet.id, wallet])
    );

    const sender = walletById.get(senderCandidate.id);
    const receiver = walletById.get(receiverCandidate.id);

    if (!sender || !receiver) {
      const err = new Error("Wallet not found");
      err.statusCode = 404;
      throw err;
    }

    if (sender.id === receiver.id) {
      const err = new Error("Cannot pay yourself");
      err.statusCode = 400;
      throw err;
    }

    if (BigInt(sender.balance_paise) < amountPaise) {
      const tx = await insertFailedTransaction(
        client, idempotencyKey, sender.id, receiver.id,
        amountPaise, "INSUFFICIENT_BALANCE"
      );
      result = { replayed: false, transaction: formatTransaction(tx) };
      return;
    }

    // Both wallet rows are locked. Now transfer is atomic.
    await client.query(
      `UPDATE wallets
       SET balance_paise = balance_paise - $1,
           version = version + 1,
           updated_at = NOW()
       WHERE id = $2`,
      [amountPaise.toString(), sender.id]
    );

    await client.query(
      `UPDATE wallets
       SET balance_paise = balance_paise + $1,
           version = version + 1,
           updated_at = NOW()
       WHERE id = $2`,
      [amountPaise.toString(), receiver.id]
    );

    const txResult = await client.query(
      `INSERT INTO transactions(
         idempotency_key, sender_wallet_id, receiver_wallet_id,
         amount_paise, status, completed_at
       )
       VALUES ($1, $2, $3, $4, 'SUCCESS', NOW())
       RETURNING id, status, amount_paise, failure_reason, created_at, completed_at`,
      [
        idempotencyKey,
        sender.id,
        receiver.id,
        amountPaise.toString()
      ]
    );

    const tx = txResult.rows[0];

    // Transactional outbox: event is committed with the money movement.
    await client.query(
      `INSERT INTO outbox_events(
         aggregate_id, topic, event_type, payload
       )
       VALUES ($1, 'payment-events', 'PAYMENT_SUCCESS',
               $2::jsonb)`,
      [
        tx.id,
        JSON.stringify({
          paymentId: tx.id,
          senderEmail: sender.email,
          receiverEmail: receiver.email,
          amountRupees: paiseToRupeesString(amountPaise),
          status: "SUCCESS"
        })
      ]
    );

    result = { replayed: false, transaction: formatTransaction(tx) };
  });

  return result;
}

async function insertFailedTransaction(client, key, senderWalletId, receiverWalletId, amountPaise, reason) {
  const result = await client.query(
    `INSERT INTO transactions(
       idempotency_key, sender_wallet_id, receiver_wallet_id,
       amount_paise, status, failure_reason, completed_at
     )
     VALUES ($1, $2, $3, $4, 'FAILED', $5, NOW())
     RETURNING id, status, amount_paise, failure_reason, created_at, completed_at`,
    [key, senderWalletId, receiverWalletId, amountPaise.toString(), reason]
  );
  return result.rows[0];
}

function formatTransaction(row) {
  return {
    id: row.id,
    status: row.status,
    amountRupees: paiseToRupeesString(row.amount_paise),
    failureReason: row.failure_reason,
    createdAt: row.created_at,
    completedAt: row.completed_at
  };
}

async function getPayment(paymentId, userId) {
  const { pool } = require("../db");
  const result = await pool.query(
    `SELECT t.*
     FROM transactions t
     JOIN wallets sw ON sw.id = t.sender_wallet_id
     JOIN wallets rw ON rw.id = t.receiver_wallet_id
     WHERE t.id = $1 AND (sw.user_id = $2 OR rw.user_id = $2)`,
    [paymentId, userId]
  );

  if (!result.rows[0]) {
    const err = new Error("Payment not found");
    err.statusCode = 404;
    throw err;
  }

  return formatTransaction(result.rows[0]);
}

async function publishOutboxBatch() {
  const { withTransaction } = require("../db");

  const events = await withTransaction(async (client) => {
    const result = await client.query(
      `SELECT *
       FROM outbox_events
       WHERE published = FALSE
       ORDER BY created_at
       LIMIT 50
       FOR UPDATE SKIP LOCKED`
    );

    if (!result.rows.length) return [];

    const ids = result.rows.map(x => x.id);

    await client.query(
      `UPDATE outbox_events
       SET published = TRUE, published_at = NOW()
       WHERE id = ANY($1::uuid[])`,
      [ids]
    );

    return result.rows;
  });

  for (const event of events) {
    await publishPaymentEvent({
      paymentId: event.aggregate_id,
      eventType: event.event_type,
      ...event.payload
    });
  }

  return events.length;
}

module.exports = { createPayment, getPayment, publishOutboxBatch };
