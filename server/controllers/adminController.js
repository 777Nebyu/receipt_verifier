const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Receipt = require("../models/Receipt");
const db = require("../config/db");

async function users(_req, res, next) {
  try {
    return res.json({ users: await User.listUsers() });
  } catch (error) {
    return next(error);
  }
}

async function createMerchant(req, res, next) {
  try {
    const { fullName, email, password } = req.body;
    const existing = await User.findByEmail(email);
    if (existing) return res.status(409).json({ message: "Email is already registered." });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.createUser({ fullName, email, passwordHash, role: "merchant" });
    return res.status(201).json({ user });
  } catch (error) {
    return next(error);
  }
}

async function updateUser(req, res, next) {
  try {
    const { fullName, email, password, role, isActive } = req.body;
    const passwordHash = password ? await bcrypt.hash(password, 12) : null;
    const user = await User.updateUser(req.params.id, { fullName, email, passwordHash, role, isActive });
    return res.json({ user });
  } catch (error) {
    return next(error);
  }
}

async function deleteUser(req, res, next) {
  try {
    await User.deleteUser(req.params.id);
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}

async function logs(_req, res, next) {
  try {
    const result = await db.query(
      `SELECT l.*, u.full_name, u.email
       FROM verification_logs l
       LEFT JOIN users u ON u.id = l.user_id
       ORDER BY l.created_at DESC
       LIMIT 200`
    );
    return res.json({ logs: result.rows });
  } catch (error) {
    return next(error);
  }
}

async function stats(_req, res, next) {
  try {
    return res.json({ stats: await Receipt.stats() });
  } catch (error) {
    return next(error);
  }
}

module.exports = { users, createMerchant, updateUser, deleteUser, logs, stats };
