import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { signToken, requireAuth } from "../lib/auth";
import { AuthTelegramBody, AuthTelegramResponse, GetMeResponse, UpdateMyNoteBody, UpdateMyNoteResponse } from "@workspace/api-zod";

const router: IRouter = Router();

function generateDisplayCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function buildUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    telegramId: user.telegramId,
    firstName: user.firstName,
    lastName: user.lastName,
    username: user.username,
    photoUrl: user.photoUrl,
    role: user.role,
    note: user.note ?? null,
    displayCode: user.displayCode ?? null,
    createdAt: user.createdAt.toISOString(),
    loyaltyStamps: user.loyaltyStamps,
    loyaltyTotalRedeemed: user.loyaltyTotalRedeemed,
  };
}

router.post("/auth/telegram", async (req, res): Promise<void> => {
  const parsed = AuthTelegramBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { telegramId, firstName, lastName, username, photoUrl } = parsed.data;

  const existing = await db.select().from(usersTable).where(eq(usersTable.telegramId, telegramId));

  let user = existing[0];

  if (!user) {
    let code = generateDisplayCode();
    let attempts = 0;
    while (attempts < 10) {
      const exists = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.displayCode, code));
      if (exists.length === 0) break;
      code = generateDisplayCode();
      attempts++;
    }
    const [created] = await db
      .insert(usersTable)
      .values({ telegramId, firstName, lastName: lastName ?? null, username: username ?? null, photoUrl: photoUrl ?? null, displayCode: code })
      .returning();
    user = created;
  } else {
    const updateData: Partial<typeof usersTable.$inferInsert> = {
      firstName,
      lastName: lastName ?? null,
      username: username ?? null,
      photoUrl: photoUrl ?? null,
    };
    if (!user.displayCode) {
      let code = generateDisplayCode();
      let attempts = 0;
      while (attempts < 10) {
        const exists = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.displayCode, code));
        if (exists.length === 0) break;
        code = generateDisplayCode();
        attempts++;
      }
      updateData.displayCode = code;
    }
    const [updated] = await db
      .update(usersTable)
      .set(updateData)
      .where(eq(usersTable.id, user.id))
      .returning();
    user = updated;
  }

  const token = signToken(user.id);

  res.json(AuthTelegramResponse.parse({ user: buildUser(user), token }));
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: typeof usersTable.$inferSelect }).user;
  res.json(GetMeResponse.parse(buildUser(user)));
});

router.patch("/users/me/note", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: typeof usersTable.$inferSelect }).user;

  const parsed = UpdateMyNoteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const note = parsed.data.note ? parsed.data.note.slice(0, 300) : null;

  const [updated] = await db
    .update(usersTable)
    .set({ note })
    .where(eq(usersTable.id, user.id))
    .returning();

  res.json(UpdateMyNoteResponse.parse(buildUser(updated)));
});

export default router;
