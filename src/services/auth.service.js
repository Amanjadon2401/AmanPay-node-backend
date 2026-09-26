const bcrypt = require("bcrypt");
const { pool } = require("../db");
const { bcryptRounds } = require("../config");
const { signToken } = require("../auth");

async function register({ name, email, password }) {
  const passwordHash = await bcrypt.hash(password, bcryptRounds);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const userResult = await client.query(
      `INSERT INTO users(name, email, password_hash)
       VALUES ($1, LOWER($2), $3)
       RETURNING id, name, email, created_at`,
      [name, email, passwordHash]
    );

    const user = userResult.rows[0];

    await client.query(
      `INSERT INTO wallets(user_id, balance_paise) VALUES ($1, 1000000)`,
      [user.id]
    );

    await client.query("COMMIT");

    return {
      user,
      token: signToken(user)
    };
  } catch (err) {
    await client.query("ROLLBACK");
    if (err.code === "23505") {
      const e = new Error("Email already registered");
      e.statusCode = 409;
      throw e;
    }
    throw err;
  } finally {
    client.release();
  }
}

async function login({ email, password }) {
  const result = await pool.query(
    `SELECT id, name, email, password_hash FROM users WHERE email = LOWER($1)`,
    [email]
  );

  const user = result.rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    const err = new Error("Invalid email or password");
    err.statusCode = 401;
    throw err;
  }

  return {
    user: { id: user.id, name: user.name, email: user.email },
    token: signToken(user)
  };
}

module.exports = { register, login };
