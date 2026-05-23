import { type Request, type Response, type NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const JWT_SECRET = process.env.SESSION_SECRET ?? "hookah-club-secret";

export function signToken(userId: number): string {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: "90d" });
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as unknown as { sub: number };
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, payload.sub));
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    (req as Request & { user: typeof user }).user = user;
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
}

export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const user = (req as Request & { user?: { role: string } }).user;
  if (!user || (user.role !== "admin" && user.role !== "staff")) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
}

export async function requireSuperAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const user = (req as Request & { user?: { role: string } }).user;
  if (!user || user.role !== "admin") {
    res.status(403).json({ error: "Forbidden: admin role required" });
    return;
  }
  next();
}
