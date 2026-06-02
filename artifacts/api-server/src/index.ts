import app from "./app";
import { logger } from "./lib/logger";
import { db, usersTable } from "@workspace/db";
import { sql } from "drizzle-orm";

// TEMPORARY: upsert owner as admin on every startup — remove after first successful deploy
async function ensureAdmin() {
  await db.execute(sql`
    INSERT INTO users (telegram_id, first_name, last_name, username, photo_url, role)
    VALUES (304953881, 'Sima', NULL, 'simaneversleep', NULL, 'admin')
    ON CONFLICT (telegram_id) DO UPDATE SET role = 'admin'
  `);
}
ensureAdmin().catch((e) => logger.error({ err: e }, "ensureAdmin failed"));

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
