const db = require("../config/db");

async function getProviderId(providerCode) {
  const result = await db.query("SELECT id FROM receipt_providers WHERE code = $1", [providerCode]);
  return result.rows[0]?.id;
}

async function createReceipt({ userId, providerCode, imagePath, extractedText, referenceCode, amount }) {
  const providerId = await getProviderId(providerCode);
  const result = await db.query(
    `INSERT INTO receipts (user_id, provider_id, image_path, extracted_text, reference_code, amount)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [userId, providerId, imagePath || null, extractedText || null, referenceCode || null, amount || null]
  );
  return result.rows[0];
}

async function saveVerification({ receiptId, isVerified, providerResponse }) {
  const result = await db.query(
    `INSERT INTO verification_results (receipt_id, is_verified, provider_response)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [receiptId, isVerified, providerResponse]
  );
  return result.rows[0];
}

async function saveLog({ userId, receiptId, action, ipAddress }) {
  await db.query(
    `INSERT INTO verification_logs (user_id, receipt_id, action, ip_address)
     VALUES ($1, $2, $3, $4)`,
    [userId, receiptId || null, action, ipAddress]
  );
}

async function historyForUser(userId, role) {
  const params = role === "admin" ? [] : [userId];
  const where = role === "admin" ? "" : "WHERE r.user_id = $1";
  const result = await db.query(
    `SELECT r.id, r.reference_code, r.amount, r.image_path, r.upload_time,
            p.name AS provider, p.code AS provider_code,
            v.is_verified, v.provider_response, v.verified_at,
            u.full_name AS user_name
     FROM receipts r
     JOIN receipt_providers p ON p.id = r.provider_id
     JOIN users u ON u.id = r.user_id
     LEFT JOIN verification_results v ON v.receipt_id = r.id
     ${where}
     ORDER BY r.upload_time DESC
     LIMIT 100`,
    params
  );
  return result.rows;
}

async function findForDownload(receiptId, userId, role) {
  const params = role === "admin" ? [receiptId] : [receiptId, userId];
  const ownerCheck = role === "admin" ? "" : "AND r.user_id = $2";
  const result = await db.query(
    `SELECT r.id, r.reference_code, r.amount, r.upload_time,
            p.name AS provider, p.code AS provider_code,
            v.is_verified, v.provider_response, v.verified_at,
            u.full_name AS user_name
     FROM receipts r
     JOIN receipt_providers p ON p.id = r.provider_id
     JOIN users u ON u.id = r.user_id
     LEFT JOIN verification_results v ON v.receipt_id = r.id
     WHERE r.id = $1 ${ownerCheck}
     ORDER BY v.verified_at DESC
     LIMIT 1`,
    params
  );
  return result.rows[0];
}

async function stats() {
  const result = await db.query(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE v.is_verified = true)::int AS verified,
       COUNT(*) FILTER (WHERE v.is_verified = false)::int AS failed,
       COALESCE(SUM(r.amount), 0)::numeric AS total_amount
     FROM receipts r
     LEFT JOIN verification_results v ON v.receipt_id = r.id`
  );

  const byProvider = await db.query(
    `SELECT p.name, COUNT(r.id)::int AS count
     FROM receipt_providers p
     LEFT JOIN receipts r ON r.provider_id = p.id
     GROUP BY p.name
     ORDER BY p.name`
  );

  return { ...result.rows[0], byProvider: byProvider.rows };
}

module.exports = { createReceipt, saveVerification, saveLog, historyForUser, findForDownload, stats };
