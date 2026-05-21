import { Router, type IRouter } from "express";
import { db, subscriptionPlansTable, userSubscriptionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { usersTable } from "@workspace/db";
import { GetSubscriptionPlansResponse, GetMySubscriptionResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/subscriptions/plans", async (_req, res): Promise<void> => {
  const plans = await db
    .select()
    .from(subscriptionPlansTable)
    .orderBy(subscriptionPlansTable.level);

  res.json(GetSubscriptionPlansResponse.parse(plans));
});

router.get("/subscriptions/my", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: typeof usersTable.$inferSelect }).user;

  const rows = await db
    .select()
    .from(userSubscriptionsTable)
    .leftJoin(subscriptionPlansTable, eq(userSubscriptionsTable.planId, subscriptionPlansTable.id))
    .where(and(eq(userSubscriptionsTable.userId, user.id), eq(userSubscriptionsTable.active, true)));

  if (rows.length === 0) {
    res.status(404).json({ error: "No active subscription" });
    return;
  }

  const row = rows[0];
  const sub = row.user_subscriptions;
  const plan = row.subscription_plans!;

  res.json(GetMySubscriptionResponse.parse({
    id: sub.id,
    userId: sub.userId,
    planId: sub.planId,
    plan,
    hookahsRemaining: sub.hookahsRemaining,
    fruitHookahsRemaining: sub.fruitHookahsRemaining,
    electricAvailable: sub.electricAvailable,
    cheapHookahAvailable: sub.cheapHookahAvailable,
    activatedAt: sub.activatedAt.toISOString(),
    expiresAt: sub.expiresAt?.toISOString() ?? null,
    note: sub.note ?? null,
  }));
});

export default router;
