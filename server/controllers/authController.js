const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

function jwtSecret() {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is required.");
  return process.env.JWT_SECRET;
}

function sign(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, fullName: user.full_name },
    jwtSecret(),
    { expiresIn: "1d" }
  );
}

async function register(req, res, next) {
  try {
    const userCount = await User.countUsers();
    if (userCount > 0) {
      return res.status(403).json({ message: "New seller accounts must be created by an admin." });
    }

    const { fullName, email, password, role } = req.body;
    const existing = await User.findByEmail(email);
    if (existing) return res.status(409).json({ message: "Email is already registered." });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.createUser({ fullName, email, passwordHash, role: role || "admin" });
    return res.status(201).json({ user, token: sign(user) });
  } catch (error) {
    return next(error);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const user = await User.findByEmail(email);
    if (!user || !user.is_active) return res.status(401).json({ message: "Invalid credentials." });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ message: "Invalid credentials." });

    delete user.password_hash;
    return res.json({ user, token: sign(user) });
  } catch (error) {
    return next(error);
  }
}

async function me(req, res, next) {
  try {
    const user = await User.findById(req.user.id);
    return res.json({ user });
  } catch (error) {
    return next(error);
  }
}

async function updateProfile(req, res, next) {
  try {
    const { fullName, password } = req.body;
    const passwordHash = password ? await bcrypt.hash(password, 12) : null;
    const user = await User.updateUser(req.user.id, { fullName, passwordHash });
    return res.json({ user, token: sign(user) });
  } catch (error) {
    return next(error);
  }
}

async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;
    const user = await User.findByEmail(email);
    if (!user || !user.is_active) return res.status(404).json({ message: "No active account found with that email." });

    return res.json({ message: "Account found. You can set a new password now." });
  } catch (error) {
    return next(error);
  }
}

async function resetPassword(req, res, next) {
  try {
    const { email, password } = req.body;
    const user = await User.findByEmail(email);
    if (!user || !user.is_active) return res.status(404).json({ message: "No active account found with that email." });

    const passwordHash = await bcrypt.hash(password, 12);
    await User.updatePasswordByEmail(email, passwordHash);
    return res.json({ message: "Password changed. Login with your new password." });
  } catch (error) {
    return next(error);
  }
}

module.exports = { register, login, me, updateProfile, forgotPassword, resetPassword };
