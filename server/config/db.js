const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : { host: "/var/run/postgresql", database: "receipt_verification" }
);

async function query(text, params) {
  return pool.query(text, params);
}

module.exports = { pool, query };
