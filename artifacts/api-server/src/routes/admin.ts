import { Router, type IRouter } from "express";
import { db, usersTable, subscriptionPlansTable, userSubscriptionsTable, actionLogsTable } from "@workspace/db";
import { eq, and, count, sum, desc, aliasedTable } from "drizzle-orm";
import { requireAuth, requireAdmin, requireSuperAdmin, getAuthedUser } from "../lib/auth";
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
  AdminGetLogsResponse,
  AdminAddLoyaltyStampParams,
  AdminAddLoyaltyStampResponse,
  AdminRedeemLoyaltyParams,
  AdminRedeemLoyaltyResponse,
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

const staffAlias = aliasedTable(usersTable, "staff_user");
const guestAlias = aliasedTable(usersTable, "guest_user");

async function logAction(staffId: number, staffName: string, guestId: number, action: string, description: string) {
  await db.insert(actionLogsTable).values({ staffId, guestId, action, description: `[${staffName}] ${description}` });
}

async function getLogsWithNames(where?: Parameters<typeof db.select>[0]) {
  const rows = await db
    .select({
      id: actionLogsTable.id,
      staffId: actionLogsTable.staffId,
      guestId: actionLogsTable.guestId,
      action: actionLogsTable.action,
      description: actionLogsTable.description,
      createdAt: actionLogsTable.createdAt,
      staffFirstName: staffAlias.firstName,
      staffLastName: staffAlias.lastName,
      guestFirstName: guestAlias.firstName,
      guestLastName: guestAlias.lastName,
    })
    .from(actionLogsTable)
    .leftJoin(staffAlias, eq(actionLogsTable.staffId, staffAlias.id))
    .leftJoin(guestAlias, eq(actionLogsTable.guestId, guestAlias.id))
    .orderBy(desc(actionLogsTable.createdAt))
    .limit(100);
  return rows.map((l) => ({
    id: l.id,
    staffId: l.staffId,
    guestId: l.guestId,
    staffName: l.staffFirstName ? `${l.staffFirstName}${l.staffLastName ? " " + l.staffLastName : ""}` : null,
    guestName: l.guestFirstName ? `${l.guestFirstName}${l.guestLastName ? " " + l.guestLastName : ""}` : null,
    action: l.action,
    description: l.description,
    createdAt: l.createdAt.toISOString(),
  }));
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
    loyaltyStamps: user.loyaltyStamps,
    loyaltyTotalRedeemed: user.loyaltyTotalRedeemed,
    subscription: row && row.subscription_plans ? buildSubDetail(row.user_subscriptions, row.subscription_plans) : undefined,
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

router.post("/admin/users/:userId/subscription", requireAuth, requireSuperAdmin, async (req, res): Promise<void> => {
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

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  const [sub] = await db
    .insert(userSubscriptionsTable)
    .values({
      userId: params.data.userId,
      planId: plan.id,
      hookahsRemaining: plan.hookahCount,
      fruitHookahsRemaining: plan.bonusHookahFruit,
      electricAvailable: plan.bonusElectric > 0,
      cheapHookahAvailable: false,
      note: body.data.note ?? null,
      active: true,
      expiresAt,
    })
    .returning();

  const staff = getAuthedUser(req);
  const staffName = `${staff.firstName}${staff.lastName ? " " + staff.lastName : ""}`;
  await logAction(staff.id, staffName, params.data.userId, "activate", `Активирована подписка: ${plan.nameRu}`);

  res.json(buildSubDetail(sub, plan));
});

router.patch("/admin/users/:userId/subscription", requireAuth, requireSuperAdmin, async (req, res): Promise<void> => {
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

  const staff = getAuthedUser(req);
  const staffName = `${staff.firstName}${staff.lastName ? " " + staff.lastName : ""}`;
  await logAction(staff.id, staffName, params.data.userId, "manual_adjust", "Ручная корректировка баланса");

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
  const plan = row.subscription_plans!;

  if (sub.hookahsRemaining <= 0) { res.status(400).json({ error: "No hookahs remaining" }); return; }

  const newRemaining = sub.hookahsRemaining - 1;
  const unlockCheap = newRemaining === 0 && plan.bonusHookahCheap > 0;

  const [updated] = await db
    .update(userSubscriptionsTable)
    .set({
      hookahsRemaining: newRemaining,
      totalHookahsUsed: sub.totalHookahsUsed + 1,
      ...(unlockCheap ? { cheapHookahAvailable: true } : {}),
    })
    .where(eq(userSubscriptionsTable.id, sub.id))
    .returning();

  const staff = getAuthedUser(req);
  const staffName = `${staff.firstName}${staff.lastName ? " " + staff.lastName : ""}`;
  await logAction(staff.id, staffName, params.data.userId, "hookah", `Кальян списан. Осталось: ${updated.hookahsRemaining}${unlockCheap ? ". Открыт кальян за 350 RSD!" : ""}`);

  res.json(buildSubDetail(updated, plan));
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
  const plan = row.subscription_plans!;

  if (sub.fruitHookahsRemaining <= 0) { res.status(400).json({ error: "No fruit hookahs remaining" }); return; }
  if (sub.hookahsRemaining <= 0) { res.status(400).json({ error: "No hookahs remaining" }); return; }

  const newFruitRemaining = sub.fruitHookahsRemaining - 1;
  const newHookahsRemaining = sub.hookahsRemaining - 1;
  const unlockCheap = newHookahsRemaining === 0 && plan.bonusHookahCheap > 0;

  const [updated] = await db
    .update(userSubscriptionsTable)
    .set({
      fruitHookahsRemaining: newFruitRemaining,
      hookahsRemaining: newHookahsRemaining,
      totalHookahsUsed: sub.totalHookahsUsed + 1,
      ...(unlockCheap ? { cheapHookahAvailable: true } : {}),
    })
    .where(eq(userSubscriptionsTable.id, sub.id))
    .returning();

  const staff = getAuthedUser(req);
  const staffName = `${staff.firstName}${staff.lastName ? " " + staff.lastName : ""}`;
  await logAction(staff.id, staffName, params.data.userId, "fruit", `Фрукт списан. Осталось фруктовых: ${updated.fruitHookahsRemaining}, кальянов: ${updated.hookahsRemaining}`);

  res.json(buildSubDetail(updated, plan));
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

  const staff = getAuthedUser(req);
  const staffName = `${staff.firstName}${staff.lastName ? " " + staff.lastName : ""}`;
  await logAction(staff.id, staffName, params.data.userId, "cheap", "Кальян за 350 RSD списан");

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

  const staff = getAuthedUser(req);
  const staffName = `${staff.firstName}${staff.lastName ? " " + staff.lastName : ""}`;
  await logAction(staff.id, staffName, params.data.userId, "electric", "Электронная чаша списана");

  res.json(buildSubDetail(updated, row.subscription_plans!));
});

router.patch("/admin/users/:userId/role", requireAuth, requireSuperAdmin, async (req, res): Promise<void> => {
  const params = AdminGetUserParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const { role } = req.body as { role?: string };
  if (!role || !["user", "staff", "admin"].includes(role)) { res.status(400).json({ error: "Invalid role" }); return; }

  const [user] = await db
    .update(usersTable)
    .set({ role: role as "user" | "staff" | "admin" })
    .where(eq(usersTable.id, params.data.userId))
    .returning();

  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  res.json({ id: user.id, telegramId: user.telegramId.toString(), firstName: user.firstName, lastName: user.lastName ?? null, username: user.username ?? null, role: user.role, note: user.note ?? null, createdAt: user.createdAt.toISOString(), subscription: null });
});

router.get("/admin/users/:userId/logs", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const params = AdminGetUserLogsParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const allLogs = await getLogsWithNames();
  const filtered = allLogs.filter((l) => l.guestId === params.data.userId).slice(0, 50);

  res.json(AdminGetUserLogsResponse.parse(filtered));
});

router.get("/admin/logs", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const logs = await getLogsWithNames();
  res.json(AdminGetLogsResponse.parse(logs.slice(0, 50)));
});

router.get("/admin/stats", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const [totalUsersRow] = await db.select({ count: count() }).from(usersTable);
  const [activeSubsRow] = await db.select({ count: count() }).from(userSubscriptionsTable).where(eq(userSubscriptionsTable.active, true));

  // All-time counts from action_logs (never deleted)
  const actionCounts = await db
    .select({ action: actionLogsTable.action, total: count() })
    .from(actionLogsTable)
    .groupBy(actionLogsTable.action);

  const byAction = (a: string) => actionCounts.find((r) => r.action === a)?.total ?? 0;

  const plans = await db.select().from(subscriptionPlansTable);
  const subscriptionsByPlan = await Promise.all(
    plans.map(async (plan) => {
      const [activeRow] = await db
        .select({ count: count() })
        .from(userSubscriptionsTable)
        .where(and(eq(userSubscriptionsTable.planId, plan.id), eq(userSubscriptionsTable.active, true)));
      const [totalRow] = await db
        .select({ count: count() })
        .from(userSubscriptionsTable)
        .where(eq(userSubscriptionsTable.planId, plan.id));
      return { planName: plan.nameRu, activeCount: activeRow.count, totalEver: totalRow.count };
    })
  );

  res.json(AdminGetStatsResponse.parse({
    totalUsers: totalUsersRow.count,
    activeSubscriptions: activeSubsRow.count,
    totalHookahsUsed: byAction("hookah") + byAction("fruit"),
    totalFruitUsed: byAction("fruit"),
    totalCheapUsed: byAction("cheap"),
    totalElectricUsed: byAction("electric"),
    totalActivations: byAction("activate"),
    subscriptionsByPlan,
  }));
});

router.post("/admin/users/:userId/loyalty/stamp", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const params = AdminAddLoyaltyStampParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, params.data.userId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const newStamps = Math.min(user.loyaltyStamps + 1, 10);
  const [updated] = await db
    .update(usersTable)
    .set({ loyaltyStamps: newStamps })
    .where(eq(usersTable.id, params.data.userId))
    .returning();

  const staff = getAuthedUser(req);
  const staffName = `${staff.firstName}${staff.lastName ? " " + staff.lastName : ""}`;
  await logAction(staff.id, staffName, params.data.userId, "loyalty_stamp", `Добавлена марка лояльности (${newStamps}/10)`);

  res.json(AdminAddLoyaltyStampResponse.parse({ loyaltyStamps: updated.loyaltyStamps, loyaltyTotalRedeemed: updated.loyaltyTotalRedeemed }));
});

router.post("/admin/users/:userId/loyalty/redeem", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const params = AdminRedeemLoyaltyParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, params.data.userId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  if (user.loyaltyStamps < 10) {
    res.status(400).json({ error: "Недостаточно марок (нужно 10)" });
    return;
  }

  const [updated] = await db
    .update(usersTable)
    .set({ loyaltyStamps: 0, loyaltyTotalRedeemed: user.loyaltyTotalRedeemed + 1 })
    .where(eq(usersTable.id, params.data.userId))
    .returning();

  const staff = getAuthedUser(req);
  const staffName = `${staff.firstName}${staff.lastName ? " " + staff.lastName : ""}`;
  await logAction(staff.id, staffName, params.data.userId, "loyalty_redeem", `Погашена карта лояльности — кальян за 350 RSD (всего: ${updated.loyaltyTotalRedeemed})`);

  res.json(AdminRedeemLoyaltyResponse.parse({ loyaltyStamps: updated.loyaltyStamps, loyaltyTotalRedeemed: updated.loyaltyTotalRedeemed }));
});

// TEMPORARY: one-shot admin promotion — remove after use
router.post("/admin/set-admin", async (req, res): Promise<void> => {
  const { secret, telegramId } = req.body as { secret?: string; telegramId?: number };
  if (!secret || secret !== process.env.SESSION_SECRET) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  if (!telegramId) {
    res.status(400).json({ error: "telegramId required" });
    return;
  }
  const [user] = await db
    .update(usersTable)
    .set({ role: "admin" })
    .where(eq(usersTable.telegramId, telegramId))
    .returning({ id: usersTable.id, telegramId: usersTable.telegramId, role: usersTable.role });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({ ok: true, ...user });
});

export default router;
