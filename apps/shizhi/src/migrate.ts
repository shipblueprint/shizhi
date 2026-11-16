import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  throw new Error("Missing required environment variable: DATABASE_URL");
}
const pool = new Pool({
  connectionString: databaseUrl,
  ssl:
    process.env.DATABASE_SSL === "true"
      ? { rejectUnauthorized: false }
      : undefined,
  max: 1,
});

const migrationPath = fileURLToPath(
  new URL("../migrations/0001_init.sql", import.meta.url)
);

try {
  const sql = await readFile(migrationPath, "utf8");
  await pool.query(sql);
  console.log("China store database schema is up to date.");
} finally {
  await pool.end();
}
