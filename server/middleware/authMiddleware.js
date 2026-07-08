const jwt = require("jsonwebtoken");

function jwtSecret() {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is required.");
  return process.env.JWT_SECRET;
}

function authenticate(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "Authentication token is required." });
  }

  try {
    req.user = jwt.verify(token, jwtSecret());
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
}

module.exports = authenticate;
