import app from "./app";
import { logger } from "./lib/logger";
import { startBot } from "./bot";
import { db, subscriptionPlansTable } from "@workspace/db";
import { eq } from "drizzle-orm";

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

const PLANS = [
  { level: 1, nameRu: "Добро пожаловать", nameRs: "DOBRODOSLI!", hookahCount: 8,  priceRsd: 15900, pricePerHookah: 1988, bonusHookahFruit: 0, bonusElectric: 0, bonusHookahCheap: 1 },
  { level: 2, nameRu: "Тебе как всегда?", nameRs: "GDE SI KOMSIJA?", hookahCount: 12, priceRsd: 22900, pricePerHookah: 1908, bonusHookahFruit: 1, bonusElectric: 0, bonusHookahCheap: 1 },
  { level: 3, nameRu: "Ну рассказывай",   nameRs: "SAMO RECI",       hookahCount: 16, priceRsd: 29300, pricePerHookah: 1831, bonusHookahFruit: 4, bonusElectric: 0, bonusHookahCheap: 1 },
  { level: 4, nameRu: "Да ты легенда!",   nameRs: "SVE ZA TEBE",     hookahCount: 20, priceRsd: 35300, pricePerHookah: 1765, bonusHookahFruit: 4, bonusElectric: 1, bonusHookahCheap: 1 },
];

async function seedPlans() {
  for (const plan of PLANS) {
    const [existing] = await db.select().from(subscriptionPlansTable).where(eq(subscriptionPlansTable.level, plan.level));
    if (!existing) {
      await db.insert(subscriptionPlansTable).values(plan);
    } else {
      await db.update(subscriptionPlansTable).set(plan).where(eq(subscriptionPlansTable.level, plan.level));
    }
  }
  logger.info("Plans seeded/updated");
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  seedPlans().catch((e) => logger.error({ err: e }, "Failed to seed plans"));
  startBot();
});
