require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const path = require("path");
const fs = require("fs");
const logger = require("./utils/logger");

const authRoutes = require("./routes/authRoutes");
const receiptRoutes = require("./routes/receiptRoutes");
const adminRoutes = require("./routes/adminRoutes");

fs.mkdirSync(path.join(__dirname, "uploads"), { recursive: true });
fs.mkdirSync(path.join(__dirname, "logs"), { recursive: true });

const app = express();
const port = process.env.PORT || 5000;

const generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 150,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many requests. Please wait and try again.",
  },
});

function createAuthLimiter() {
  return rateLimit({
    windowMs: 60 * 1000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      message: "Too many authentication attempts. Please wait one minute and try again.",
    },
  });
}

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173" }));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use("/api", generalApiLimiter);
app.use(morgan("combined", { stream: { write: (message) => logger.info(message.trim()) } }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "receipt-verification-api" });
});

app.use("/api/auth/register", createAuthLimiter());
app.use("/api/auth/login", createAuthLimiter());
app.use("/api/auth/forgot-password", createAuthLimiter());
app.use("/api/auth/reset-password", createAuthLimiter());
app.use("/api/auth", authRoutes);
app.use("/api/receipt", receiptRoutes);
app.use("/api/admin", adminRoutes);

app.use((req, res) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
});

app.use((error, _req, res, _next) => {
  logger.error(error);
  res.status(error.status || 500).json({
    message: error.message || "Internal server error.",
  });
});

if (require.main === module) {
  app.listen(port, () => {
    logger.info(`Express API running on http://localhost:${port}`);
  });
}

module.exports = app;
