import { Router, type IRouter } from "express";
import { db, usersTable, subscriptionPlansTable, userSubscriptionsTable, actionLogsTable } from "@workspace/db";
import { eq, and, count, sum, desc } from "drizzle-orm";
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
  AdminUseFruitParams,
  AdminUseCheapParams,
  AdminUseElectricParams,
  AdminGetUserLogsParams,
  AdminGetUserLogsResponse,
  AdminGetStatsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

type AuthedReq = typeof import("express").request & { user: typeof usersTable.$inferSelect };

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

async function logAction(staffId: number, guestId: number, action: string, description: string) {
  await db.insert(actionLogsTable).values({ staffId, guestId, action, description });
}

function buildUserView(user: typeof usersTable.$inferSelect, row?: { user_subscriptions: typeof userSubscriptionsTable.$inferSelect; subscription_plans: typeof subscriptionPlansTable.$inferSelect | null } | null) {
  return {
    id: user.id,
    telegramId: user.telegramId,
    firstName: user.firstName,
    lastName: user.lastName,
    username: user.username,
    role: user.role,
    note: user.note ?? null,
    createdAt: user.createdAt.toISOString(),
    subscription: row ? buildSubDetail(row.user_subscriptions, row.subscription_plans!) : undefined,
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
      return buildUserView(user, rows[0]);
    })
  );

  res.json(AdminGetUsersResponse.parse(result));
});

router.get("/admin/users/:userId", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const params = AdminGetUserParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, params.data.userId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const rows = await db
    .select()
    .from(userSubscriptionsTable)
    .leftJoin(subscriptionPlansTable, eq(userSubscriptionsTable.planId, subscriptionPlansTable.id))
    .where(and(eq(userSubscriptionsTable.userId, user.id), eq(userSubscriptionsTable.active, true)));

  res.json(AdminGetUserResponse.parse(buildUserView(user, rows[0])));
});

router.post("/admin/users/:userId/subscription", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const params = AdminActivateSubscriptionParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const body = AdminActivateSubscriptionBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const [plan] = await db.select().from(subscriptionPlansTable).where(eq(subscriptionPlansTable.id, body.data.planId));
  if (!plan) { res.status(404).json({ error: "Plan not found" }); return; }

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

  const staff = (req as unknown as AuthedReq).user;
  await logAction(staff.id, params.data.userId, "activate", `Активирована подписка: ${plan.nameRu}`);

  res.json(buildSubDetail(sub, plan));
});

router.patch("/admin/users/:userId/subscription", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const params = AdminUpdateSubscriptionParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const body = AdminUpdateSubscriptionBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const rows = await db
    .select()
    .from(userSubscriptionsTable)
    .leftJoin(subscriptionPlansTable, eq(userSubscriptionsTable.planId, subscriptionPlansTable.id))
    .where(and(eq(userSubscriptionsTable.userId, params.data.userId), eq(userSubscriptionsTable.active, true)));

  if (rows.length === 0) { res.status(404).json({ error: "No active subscription" }); return; }

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

  const staff = (req as unknown as AuthedReq).user;
  await logAction(staff.id, params.data.userId, "manual_adjust", "Ручная корректировка баланса");

  const row = rows[0];
  res.json(buildSubDetail(updated, row.subscription_plans!));
});

router.post("/admin/users/:userId/use-hookah", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const params = AdminUseHookahParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const rows = await db
    .select()
    .from(userSubscriptionsTable)
    .leftJoin(subscriptionPlansTable, eq(userSubscriptionsTable.planId, subscriptionPlansTable.id))
    .where(and(eq(userSubscriptionsTable.userId, params.data.userId), eq(userSubscriptionsTable.active, true)));

  if (rows.length === 0) { res.status(404).json({ error: "No active subscription" }); return; }

  const row = rows[0];
  const sub = row.user_subscriptions;

  if (sub.hookahsRemaining <= 0) { res.status(400).json({ error: "No hookahs remaining" }); return; }

  const [updated] = await db
    .update(userSubscriptionsTable)
    .set({ hookahsRemaining: sub.hookahsRemaining - 1, totalHookahsUsed: sub.totalHookahsUsed + 1 })
    .where(eq(userSubscriptionsTable.id, sub.id))
    .returning();

  const staff = (req as unknown as AuthedReq).user;
  await logAction(staff.id, params.data.userId, "hookah", `Кальян списан. Осталось: ${updated.hookahsRemaining}`);

  res.json(buildSubDetail(updated, row.subscription_plans!));
});

router.post("/admin/users/:userId/use-fruit", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const params = AdminUseFruitParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const rows = await db
    .select()
    .from(userSubscriptionsTable)
    .leftJoin(subscriptionPlansTable, eq(userSubscriptionsTable.planId, subscriptionPlansTable.id))
    .where(and(eq(userSubscriptionsTable.userId, params.data.userId), eq(userSubscriptionsTable.active, true)));

  if (rows.length === 0) { res.status(404).json({ error: "No active subscription" }); return; }

  const row = rows[0];
  const sub = row.user_subscriptions;

  if (sub.fruitHookahsRemaining <= 0) { res.status(400).json({ error: "No fruit hookahs remaining" }); return; }

  const [updated] = await db
    .update(userSubscriptionsTable)
    .set({ fruitHookahsRemaining: sub.fruitHookahsRemaining - 1 })
    .where(eq(userSubscriptionsTable.id, sub.id))
    .returning();

  const staff = (req as unknown as AuthedReq).user;
  await logAction(staff.id, params.data.userId, "fruit", `Фрукт списан. Осталось: ${updated.fruitHookahsRemaining}`);

  res.json(buildSubDetail(updated, row.subscription_plans!));
});

router.post("/admin/users/:userId/use-cheap", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const params = AdminUseCheapParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const rows = await db
    .select()
    .from(userSubscriptionsTable)
    .leftJoin(subscriptionPlansTable, eq(userSubscriptionsTable.planId, subscriptionPlansTable.id))
    .where(and(eq(userSubscriptionsTable.userId, params.data.userId), eq(userSubscriptionsTable.active, true)));

  if (rows.length === 0) { res.status(404).json({ error: "No active subscription" }); return; }

  const row = rows[0];
  const sub = row.user_subscriptions;

  if (!sub.cheapHookahAvailable) { res.status(400).json({ error: "Not available" }); return; }

  const [updated] = await db
    .update(userSubscriptionsTable)
    .set({ cheapHookahAvailable: false })
    .where(eq(userSubscriptionsTable.id, sub.id))
    .returning();

  const staff = (req as unknown as AuthedReq).user;
  await logAction(staff.id, params.data.userId, "cheap", "Кальян за 350 RSD списан");

  res.json(buildSubDetail(updated, row.subscription_plans!));
});

router.post("/admin/users/:userId/use-electric", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const params = AdminUseElectricParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const rows = await db
    .select()
    .from(userSubscriptionsTable)
    .leftJoin(subscriptionPlansTable, eq(userSubscriptionsTable.planId, subscriptionPlansTable.id))
    .where(and(eq(userSubscriptionsTable.userId, params.data.userId), eq(userSubscriptionsTable.active, true)));

  if (rows.length === 0) { res.status(404).json({ error: "No active subscription" }); return; }

  const row = rows[0];
  const sub = row.user_subscriptions;

  if (!sub.electricAvailable) { res.status(400).json({ error: "Not available" }); return; }

  const [updated] = await db
    .update(userSubscriptionsTable)
    .set({ electricAvailable: false })
    .where(eq(userSubscriptionsTable.id, sub.id))
    .returning();

  const staff = (req as unknown as AuthedReq).user;
  await logAction(staff.id, params.data.userId, "electric", "Электронная чаша списана");

  res.json(buildSubDetail(updated, row.subscription_plans!));
});

router.get("/admin/users/:userId/logs", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const params = AdminGetUserLogsParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const logs = await db
    .select()
    .from(actionLogsTable)
    .where(eq(actionLogsTable.guestId, params.data.userId))
    .orderBy(desc(actionLogsTable.createdAt))
    .limit(50);

  res.json(AdminGetUserLogsResponse.parse(
    logs.map((l) => ({
      id: l.id,
      staffId: l.staffId,
      guestId: l.guestId,
      action: l.action,
      description: l.description,
      createdAt: l.createdAt.toISOString(),
    }))
  ));
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
