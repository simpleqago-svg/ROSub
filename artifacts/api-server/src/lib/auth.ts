import { type Request, type Response, type NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

type UserRow = typeof usersTable.$inferSelect;
type AuthedRequest = Request & { user: UserRow };

const JWT_SECRET = process.env.SESSION_SECRET;
if (!JWT_SECRET) throw new Error("SESSION_SECRET environment variable is required");
const SECRET = JWT_SECRET as string;

export function signToken(userId: number): string {
  return jwt.sign({ sub: userId }, SECRET, { expiresIn: "90d" });
}

export function getAuthedUser(req: Request): UserRow {
  return (req as AuthedRequest).user;
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
    const payload = jwt.verify(token, SECRET) as unknown as { sub: number };
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.sub));
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    (req as AuthedRequest).user = user;
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const user = (req as Partial<AuthedRequest>).user;
  if (!user || (user.role !== "admin" && user.role !== "staff")) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  const user = (req as Partial<AuthedRequest>).user;
  if (!user || user.role !== "admin") {
    res.status(403).json({ error: "Forbidden: admin role required" });
    return;
  }
  next();
}
