CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'merchant' CHECK (role IN ('merchant', 'admin')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS receipt_providers (
    id SERIAL PRIMARY KEY,
    code VARCHAR(30) UNIQUE NOT NULL,
    name VARCHAR(50) UNIQUE NOT NULL
);

ALTER TABLE receipt_providers ADD COLUMN IF NOT EXISTS code VARCHAR(30);
UPDATE receipt_providers SET code = 'telebirr' WHERE LOWER(name) = 'telebirr' AND code IS NULL;
UPDATE receipt_providers SET code = 'cbe' WHERE LOWER(name) LIKE '%commercial bank%' AND code IS NULL;
UPDATE receipt_providers SET code = 'boa' WHERE LOWER(name) LIKE '%abyssinia%' AND code IS NULL;
UPDATE receipt_providers SET name = 'Bank of Abyssinia' WHERE code = 'boa';
DELETE FROM receipt_providers WHERE code IS NULL;
ALTER TABLE receipt_providers ALTER COLUMN code SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_receipt_providers_code ON receipt_providers(code);

CREATE TABLE IF NOT EXISTS receipts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider_id INTEGER NOT NULL REFERENCES receipt_providers(id),
    image_path TEXT,
    extracted_text TEXT,
    reference_code VARCHAR(100),
    amount NUMERIC(12,2),
    upload_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS verification_results (
    id SERIAL PRIMARY KEY,
    receipt_id INTEGER NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
    is_verified BOOLEAN NOT NULL,
    provider_response JSONB,
    verified_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS verification_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    receipt_id INTEGER REFERENCES receipts(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    ip_address VARCHAR(100),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN NOT NULL DEFAULT FALSE
);

INSERT INTO receipt_providers (code, name)
VALUES
  ('telebirr', 'Telebirr'),
  ('cbe', 'Commercial Bank of Ethiopia'),
  ('boa', 'Bank of Abyssinia')
ON CONFLICT (code) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_receipts_user_id ON receipts(user_id);
CREATE INDEX IF NOT EXISTS idx_receipts_reference ON receipts(reference_code);
CREATE INDEX IF NOT EXISTS idx_verification_logs_user_id ON verification_logs(user_id);
