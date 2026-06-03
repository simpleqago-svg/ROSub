import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { signToken, requireAuth } from "../lib/auth";
import { AuthTelegramBody, AuthTelegramResponse, GetMeResponse, UpdateMyNoteBody, UpdateMyNoteResponse } from "@workspace/api-zod";

const router: IRouter = Router();

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
    const [created] = await db
      .insert(usersTable)
      .values({ telegramId, firstName, lastName: lastName ?? null, username: username ?? null, photoUrl: photoUrl ?? null })
      .returning();
    user = created;
  } else {
    const [updated] = await db
      .update(usersTable)
      .set({ firstName, lastName: lastName ?? null, username: username ?? null, photoUrl: photoUrl ?? null })
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
