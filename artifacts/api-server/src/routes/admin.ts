import { Router, type IRouter } from "express";
import { db, usersTable, subscriptionPlansTable, userSubscriptionsTable } from "@workspace/db";
import { eq, and, count, sum } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/auth";
import {
  AdminGetUsersResponse,
  AdminGetUserParams,
  AdminGetUserResponse,
  AdminActivateSubscriptionBody,
  AdminActivateSubscriptionParams,
  AdminUpdateSubscriptionBody,
  AdminUpdateSubscriptionParams,
  AdminUseHookahParams,
  AdminGetStatsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function buildSubDetail(sub: typeof userSubscriptionsTable.$inferSelect, plan: typeof subscriptionPlansTable.$inferSelect) {
  return {
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
  };
}

router.get("/admin/users", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const users = await db.select().from(usersTable).orderBy(usersTable.createdAt);

  const result = await Promise.all(
    users.map(async (user) => {
      const rows = await db
        .select()
        .from(userSubscriptionsTable)
        .leftJoin(subscriptionPlansTable, eq(userSubscriptionsTable.planId, subscriptionPlansTable.id))
        .where(and(eq(userSubscriptionsTable.userId, user.id), eq(userSubscriptionsTable.active, true)));

      const row = rows[0];
      return {
        id: user.id,
        telegramId: user.telegramId,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
        subscription: row ? buildSubDetail(row.user_subscriptions, row.subscription_plans!) : undefined,
      };
    })
  );

  res.json(AdminGetUsersResponse.parse(result));
});

router.get("/admin/users/:userId", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const params = AdminGetUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, params.data.userId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const rows = await db
    .select()
    .from(userSubscriptionsTable)
    .leftJoin(subscriptionPlansTable, eq(userSubscriptionsTable.planId, subscriptionPlansTable.id))
    .where(and(eq(userSubscriptionsTable.userId, user.id), eq(userSubscriptionsTable.active, true)));

  const row = rows[0];

  res.json(AdminGetUserResponse.parse({
    id: user.id,
    telegramId: user.telegramId,
    firstName: user.firstName,
    lastName: user.lastName,
    username: user.username,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
    subscription: row ? buildSubDetail(row.user_subscriptions, row.subscription_plans!) : undefined,
  }));
});

router.post("/admin/users/:userId/subscription", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const params = AdminActivateSubscriptionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = AdminActivateSubscriptionBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [plan] = await db.select().from(subscriptionPlansTable).where(eq(subscriptionPlansTable.id, body.data.planId));
  if (!plan) {
    res.status(404).json({ error: "Plan not found" });
    return;
  }

  await db
    .update(userSubscriptionsTable)
    .set({ active: false })
    .where(and(eq(userSubscriptionsTable.userId, params.data.userId), eq(userSubscriptionsTable.active, true)));

  const [sub] = await db
    .insert(userSubscriptionsTable)
    .values({
      userId: params.data.userId,
      planId: plan.id,
      hookahsRemaining: plan.hookahCount,
      fruitHookahsRemaining: plan.bonusHookahFruit,
      electricAvailable: plan.bonusElectric > 0,
      cheapHookahAvailable: plan.bonusHookahCheap > 0,
      note: body.data.note ?? null,
      active: true,
    })
    .returning();

  res.json(AdminActivateSubscriptionBody.parse(buildSubDetail(sub, plan)));
});

router.patch("/admin/users/:userId/subscription", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const params = AdminUpdateSubscriptionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = AdminUpdateSubscriptionBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const rows = await db
    .select()
    .from(userSubscriptionsTable)
    .leftJoin(subscriptionPlansTable, eq(userSubscriptionsTable.planId, subscriptionPlansTable.id))
    .where(and(eq(userSubscriptionsTable.userId, params.data.userId), eq(userSubscriptionsTable.active, true)));

  if (rows.length === 0) {
    res.status(404).json({ error: "No active subscription" });
    return;
  }

  const updateData: Partial<typeof userSubscriptionsTable.$inferInsert> = {};
  if (body.data.hookahsRemaining != null) updateData.hookahsRemaining = body.data.hookahsRemaining;
  if (body.data.fruitHookahsRemaining != null) updateData.fruitHookahsRemaining = body.data.fruitHookahsRemaining;
  if (body.data.electricAvailable != null) updateData.electricAvailable = body.data.electricAvailable;
  if (body.data.cheapHookahAvailable != null) updateData.cheapHookahAvailable = body.data.cheapHookahAvailable;
  if (body.data.note !== undefined) updateData.note = body.data.note;

  const [updated] = await db
    .update(userSubscriptionsTable)
    .set(updateData)
    .where(and(eq(userSubscriptionsTable.userId, params.data.userId), eq(userSubscriptionsTable.active, true)))
    .returning();

  const row = rows[0];
  res.json(buildSubDetail(updated, row.subscription_plans!));
});

router.post("/admin/users/:userId/use-hookah", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const params = AdminUseHookahParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const rows = await db
    .select()
    .from(userSubscriptionsTable)
    .leftJoin(subscriptionPlansTable, eq(userSubscriptionsTable.planId, subscriptionPlansTable.id))
    .where(and(eq(userSubscriptionsTable.userId, params.data.userId), eq(userSubscriptionsTable.active, true)));

  if (rows.length === 0) {
    res.status(404).json({ error: "No active subscription" });
    return;
  }

  const row = rows[0];
  const sub = row.user_subscriptions;

  if (sub.hookahsRemaining <= 0) {
    res.status(400).json({ error: "No hookahs remaining" });
    return;
  }

  const [updated] = await db
    .update(userSubscriptionsTable)
    .set({
      hookahsRemaining: sub.hookahsRemaining - 1,
      totalHookahsUsed: sub.totalHookahsUsed + 1,
    })
    .where(eq(userSubscriptionsTable.id, sub.id))
    .returning();

  res.json(buildSubDetail(updated, row.subscription_plans!));
});

router.get("/admin/stats", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const [totalUsersRow] = await db.select({ count: count() }).from(usersTable);
  const [activeSubsRow] = await db.select({ count: count() }).from(userSubscriptionsTable).where(eq(userSubscriptionsTable.active, true));
  const [hookahsUsedRow] = await db.select({ total: sum(userSubscriptionsTable.totalHookahsUsed) }).from(userSubscriptionsTable);

  const plans = await db.select().from(subscriptionPlansTable);
  const subscriptionsByPlan = await Promise.all(
    plans.map(async (plan) => {
      const [row] = await db
        .select({ count: count() })
        .from(userSubscriptionsTable)
        .where(and(eq(userSubscriptionsTable.planId, plan.id), eq(userSubscriptionsTable.active, true)));
      return { planName: plan.nameRu, count: row.count };
    })
  );

  res.json(AdminGetStatsResponse.parse({
    totalUsers: totalUsersRow.count,
    activeSubscriptions: activeSubsRow.count,
    totalHookahsUsed: Number(hookahsUsedRow.total ?? 0),
    subscriptionsByPlan,
  }));
});

export default router;
