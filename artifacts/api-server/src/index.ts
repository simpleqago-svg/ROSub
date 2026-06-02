import app from "./app";
import { logger } from "./lib/logger";
import { db, usersTable, actionLogsTable, userSubscriptionsTable } from "@workspace/db";
import { eq, not } from "drizzle-orm";

// TEMPORARY: cleanup + set admin — remove after deploy
async function bootstrapProd() {
  await db.delete(actionLogsTable);
  await db.delete(userSubscriptionsTable);
  await db.delete(usersTable).where(not(eq(usersTable.telegramId, 304953881)));
  await db.update(usersTable).set({ role: "admin" }).where(eq(usersTable.telegramId, 304953881));
}
bootstrapProd().catch((e) => logger.error({ err: e }, "bootstrapProd failed"));

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
