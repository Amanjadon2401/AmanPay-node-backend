const jwt = require("jsonwebtoken");
const { jwtSecret, jwtExpiresIn } = require("./config");

function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email },
    jwtSecret,
    { expiresIn: jwtExpiresIn }
  );
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "Missing Bearer token" });
  }

  try {
    req.user = jwt.verify(token, jwtSecret);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

module.exports = { signToken, requireAuth };
