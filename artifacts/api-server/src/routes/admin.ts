import { Router, type IRouter } from "express";
import { db, usersTable, subscriptionPlansTable, userSubscriptionsTable, actionLogsTable } from "@workspace/db";
import { eq, and, count, sum, desc, aliasedTable, inArray } from "drizzle-orm";
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
    frozenUntil: sub.frozenUntil?.toISOString() ?? null,
    note: sub.note ?? null,
    isLegacy: sub.isLegacy,
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
    displayCode: user.displayCode ?? null,
    createdAt: user.createdAt.toISOString(),
    loyaltyStamps: user.loyaltyStamps,
    loyaltyTotalRedeemed: user.loyaltyTotalRedeemed,
    subscription: row && row.subscription_plans ? buildSubDetail(row.user_subscriptions, row.subscription_plans) : undefined,
  };
}

router.get("/admin/staff", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const staff = await db.select().from(usersTable)
    .where(inArray(usersTable.role, ["staff", "admin"]))
    .orderBy(usersTable.role, usersTable.createdAt);

  const result = await Promise.all(
    staff.map(async (user) => {
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

router.get("/admin/users", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const users = await db.select().from(usersTable)
    .where(eq(usersTable.role, "user"))
    .orderBy(usersTable.createdAt);

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

router.get("/admin/users/by-code/:code", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const code = String(req.params.code ?? "").toUpperCase();
  if (!code) { res.status(400).json({ error: "Code required" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.displayCode, code));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const rows = await db
    .select()
    .from(userSubscriptionsTable)
    .leftJoin(subscriptionPlansTable, eq(userSubscriptionsTable.planId, subscriptionPlansTable.id))
    .where(and(eq(userSubscriptionsTable.userId, user.id), eq(userSubscriptionsTable.active, true)));

  res.json(AdminGetUserResponse.parse(buildUserView(user, rows[0])));
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

  const isLegacy = body.data.isLegacy === true;
  if (isLegacy) {
    const [legacyRow] = await db
      .select({ count: count() })
      .from(userSubscriptionsTable)
      .where(and(eq(userSubscriptionsTable.isLegacy, true), eq(userSubscriptionsTable.active, true)));
    if ((legacyRow?.count ?? 0) >= 10) {
      res.status(400).json({ error: "Достигнут лимит: максимум 10 гостей на старых ценах" });
      return;
    }
  }

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
      isLegacy,
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

// Delete user and all their data — super admin only
router.delete("/admin/users/:userId", requireAuth, requireSuperAdmin, async (req, res): Promise<void> => {
  const params = AdminGetUserParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, params.data.userId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  // Prevent self-deletion
  const staff = getAuthedUser(req);
  if (staff.id === params.data.userId) {
    res.status(400).json({ error: "Нельзя удалить себя" });
    return;
  }

  // Delete in order: logs, subscriptions, user
  await db.delete(actionLogsTable).where(eq(actionLogsTable.guestId, params.data.userId));
  await db.delete(userSubscriptionsTable).where(eq(userSubscriptionsTable.userId, params.data.userId));
  await db.delete(usersTable).where(eq(usersTable.id, params.data.userId));

  res.json({ ok: true });
});

router.post("/admin/users/:userId/subscription/cancel", requireAuth, requireSuperAdmin, async (req, res): Promise<void> => {
  const params = AdminGetUserParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [cancelled] = await db
    .update(userSubscriptionsTable)
    .set({
      active: false,
      hookahsRemaining: 0,
      fruitHookahsRemaining: 0,
      electricAvailable: false,
      cheapHookahAvailable: false,
    })
    .where(and(eq(userSubscriptionsTable.userId, params.data.userId), eq(userSubscriptionsTable.active, true)))
    .returning();

  if (!cancelled) { res.status(404).json({ error: "No active subscription" }); return; }

  const staff = getAuthedUser(req);
  const staffName = `${staff.firstName}${staff.lastName ? " " + staff.lastName : ""}`;
  await logAction(staff.id, staffName, params.data.userId, "cancel", "Подписка отменена — остатки списаны");

  res.status(204).send();
});

router.post("/admin/users/:userId/subscription/freeze", requireAuth, requireSuperAdmin, async (req, res): Promise<void> => {
  const params = AdminGetUserParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const { days } = req.body as { days?: number };
  if (!days || !Number.isInteger(days) || days < 1 || days > 7) {
    res.status(400).json({ error: "days must be integer 1–7" }); return;
  }

  const rows = await db
    .select()
    .from(userSubscriptionsTable)
    .leftJoin(subscriptionPlansTable, eq(userSubscriptionsTable.planId, subscriptionPlansTable.id))
    .where(and(eq(userSubscriptionsTable.userId, params.data.userId), eq(userSubscriptionsTable.active, true)));

  if (rows.length === 0) { res.status(404).json({ error: "No active subscription" }); return; }

  const row = rows[0];
  const frozenUntil = new Date(Date.now() + days * 86_400_000);
  const newExpiresAt = row.user_subscriptions.expiresAt
    ? new Date(row.user_subscriptions.expiresAt.getTime() + days * 86_400_000)
    : null;

  const [updated] = await db
    .update(userSubscriptionsTable)
    .set({ frozenUntil, ...(newExpiresAt ? { expiresAt: newExpiresAt } : {}) })
    .where(eq(userSubscriptionsTable.id, row.user_subscriptions.id))
    .returning();

  const staff = getAuthedUser(req);
  const staffName = `${staff.firstName}${staff.lastName ? " " + staff.lastName : ""}`;
  await logAction(staff.id, staffName, params.data.userId, "freeze", `Подписка заморожена на ${days} дн.`);

  res.json(buildSubDetail(updated, row.subscription_plans!));
});

router.post("/admin/users/:userId/subscription/change-plan", requireAuth, requireSuperAdmin, async (req, res): Promise<void> => {
  const params = AdminGetUserParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const { planId } = req.body as { planId?: number };
  if (!planId || !Number.isInteger(planId)) { res.status(400).json({ error: "planId required" }); return; }

  const [plan] = await db.select().from(subscriptionPlansTable).where(eq(subscriptionPlansTable.id, planId));
  if (!plan) { res.status(404).json({ error: "Plan not found" }); return; }

  const [existing] = await db
    .select()
    .from(userSubscriptionsTable)
    .where(and(eq(userSubscriptionsTable.userId, params.data.userId), eq(userSubscriptionsTable.active, true)));

  if (!existing) { res.status(404).json({ error: "No active subscription" }); return; }

  const [updated] = await db
    .update(userSubscriptionsTable)
    .set({
      planId: plan.id,
      hookahsRemaining: plan.hookahCount,
      fruitHookahsRemaining: plan.bonusHookahFruit,
      electricAvailable: plan.bonusElectric > 0,
    })
    .where(eq(userSubscriptionsTable.id, existing.id))
    .returning();

  const staff = getAuthedUser(req);
  const staffName = `${staff.firstName}${staff.lastName ? " " + staff.lastName : ""}`;
  await logAction(staff.id, staffName, params.data.userId, "manual_adjust", `Смена уровня: → ${plan.nameRu}`);

  res.json(buildSubDetail(updated, plan));
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
  const [totalUsersRow] = await db.select({ count: count() }).from(usersTable).where(eq(usersTable.role, "user"));
  const [activeSubsRow] = await db.select({ count: count() }).from(userSubscriptionsTable).where(eq(userSubscriptionsTable.active, true));
  const [legacyRow] = await db.select({ count: count() }).from(userSubscriptionsTable).where(and(eq(userSubscriptionsTable.isLegacy, true), eq(userSubscriptionsTable.active, true)));

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
    legacyActiveCount: legacyRow?.count ?? 0,
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

// Export all action logs as CSV — also accepts ?token= for Telegram Mini App downloads
router.get("/admin/export-logs", async (req, res, next): Promise<void> => {
  // Inject query-param token into Authorization header if present
  const qToken = req.query.token as string | undefined;
  if (qToken && !req.headers.authorization) {
    req.headers.authorization = `Bearer ${qToken}`;
  }
  next();
}, requireAuth, requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      id: actionLogsTable.id,
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
    .orderBy(desc(actionLogsTable.createdAt));

  const ACTION_RU: Record<string, string> = {
    hookah: "🌿 Кальян",
    fruit: "🍉 Фруктовая чаша",
    cheap: "💰 Кальян за 350 RSD",
    electric: "⚡ Электронная чаша",
    activate: "✅ Активация подписки",
    manual_adjust: "✏️ Корректировка",
    loyalty_stamp: "🌿 Марка лояльности",
    loyalty_redeem: "🎉 Погашение карты",
    cancel: "❌ Отмена подписки",
    freeze: "⏸ Заморозка",
    change_plan: "🔄 Смена плана",
  };

  // Summary counts
  const counts: Record<string, number> = {};
  for (const r of rows) {
    counts[r.action] = (counts[r.action] ?? 0) + 1;
  }

  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const tableRows = rows.map((r) => {
    const dt = r.createdAt.toLocaleString("ru-RU", { timeZone: "Europe/Belgrade" });
    const action = ACTION_RU[r.action] ?? r.action;
    const guest = r.guestFirstName ? esc(`${r.guestFirstName}${r.guestLastName ? " " + r.guestLastName : ""}`) : "—";
    const staff = r.staffFirstName ? esc(`${r.staffFirstName}${r.staffLastName ? " " + r.staffLastName : ""}`) : "—";
    const desc = esc(r.description ?? "");
    return `<tr><td>${dt}</td><td>${action}</td><td>${guest}</td><td>${staff}</td><td class="desc">${desc}</td></tr>`;
  }).join("\n");

  const summaryRows = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([action, cnt]) => `<tr><td>${ACTION_RU[action] ?? action}</td><td><strong>${cnt}</strong></td></tr>`)
    .join("\n");

  const generatedAt = new Date().toLocaleString("ru-RU", { timeZone: "Europe/Belgrade" });

  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Rodina — Отчётность</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 13px; color: #1a1208; background: #fff; padding: 24px 16px; }
  h1 { font-size: 22px; font-weight: 700; color: #b45309; margin-bottom: 2px; }
  .subtitle { font-size: 12px; color: #78716c; margin-bottom: 20px; }
  .section-title { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #78716c; margin: 20px 0 8px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th { background: #fef3c7; color: #92400e; font-size: 11px; text-align: left; padding: 7px 10px; border-bottom: 2px solid #fcd34d; }
  td { padding: 6px 10px; border-bottom: 1px solid #f5f5f4; vertical-align: top; }
  tr:nth-child(even) td { background: #fafaf9; }
  .desc { color: #57534e; font-size: 12px; max-width: 220px; }
  .summary-table { max-width: 320px; }
  .summary-table td:last-child { text-align: right; }
  .total { font-size: 12px; color: #78716c; margin-top: 8px; }
  @media print {
    body { padding: 12px; }
    .no-print { display: none; }
  }
  .print-btn { display: inline-block; margin-bottom: 20px; background: #b45309; color: #fff; border: none; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
</style>
</head>
<body>
<button class="print-btn no-print" onclick="window.print()">🖨 Сохранить / Распечатать</button>
<h1>Rodina — Отчётность</h1>
<div class="subtitle">Сгенерировано: ${generatedAt} · Всего записей: ${rows.length}</div>

<div class="section-title">Итоги по действиям</div>
<table class="summary-table">
  <thead><tr><th>Действие</th><th>Кол-во</th></tr></thead>
  <tbody>${summaryRows}</tbody>
</table>

<div class="section-title">Все действия (новые сверху)</div>
<table>
  <thead><tr><th>Дата и время</th><th>Действие</th><th>Гость</th><th>Сотрудник</th><th>Описание</th></tr></thead>
  <tbody>${tableRows || '<tr><td colspan="5" style="text-align:center;color:#78716c;padding:20px">Нет данных</td></tr>'}</tbody>
</table>
<div class="total">Rodina Bar, Белград · ${generatedAt}</div>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
});


// Delete a single action log entry — super admin only
router.delete("/admin/logs/:id", requireAuth, requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const deleted = await db.delete(actionLogsTable).where(eq(actionLogsTable.id, id)).returning();
  if (deleted.length === 0) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({ ok: true });
});

export default router;
