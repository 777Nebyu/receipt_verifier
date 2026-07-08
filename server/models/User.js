const db = require("../config/db");

async function createUser({ fullName, email, passwordHash, role = "merchant" }) {
  const result = await db.query(
    `INSERT INTO users (full_name, email, password_hash, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, full_name, email, role, is_active, created_at`,
    [fullName, email.toLowerCase(), passwordHash, role]
  );
  return result.rows[0];
}

async function findByEmail(email) {
  const result = await db.query("SELECT * FROM users WHERE email = $1", [email.toLowerCase()]);
  return result.rows[0];
}

async function findById(id) {
  const result = await db.query(
    "SELECT id, full_name, email, role, is_active, created_at FROM users WHERE id = $1",
    [id]
  );
  return result.rows[0];
}

async function listUsers() {
  const result = await db.query(
    "SELECT id, full_name, email, role, is_active, created_at FROM users WHERE is_active = true ORDER BY created_at DESC"
  );
  return result.rows;
}

async function countUsers() {
  const result = await db.query("SELECT COUNT(*)::int AS count FROM users");
  return result.rows[0].count;
}

async function updateUser(id, fields) {
  const result = await db.query(
    `UPDATE users
     SET full_name = COALESCE($2, full_name),
         email = COALESCE($3, email),
         password_hash = COALESCE($4, password_hash),
         role = COALESCE($5, role),
         is_active = COALESCE($6, is_active)
     WHERE id = $1
     RETURNING id, full_name, email, role, is_active, created_at`,
    [
      id,
      fields.fullName ?? null,
      fields.email?.toLowerCase() ?? null,
      fields.passwordHash ?? null,
      fields.role ?? null,
      fields.isActive ?? null,
    ]
  );
  return result.rows[0];
}

async function deleteUser(id) {
  await db.query("UPDATE users SET is_active = false WHERE id = $1", [id]);
}

async function updatePasswordByEmail(email, passwordHash) {
  const result = await db.query(
    `UPDATE users
     SET password_hash = $2
     WHERE email = $1 AND is_active = true
     RETURNING id, full_name, email, role, is_active, created_at`,
    [email.toLowerCase(), passwordHash]
  );
  return result.rows[0];
}

module.exports = {
  createUser,
  findByEmail,
  findById,
  listUsers,
  countUsers,
  updateUser,
  deleteUser,
  updatePasswordByEmail,
};
