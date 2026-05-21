import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const actionLogsTable = pgTable("action_logs", {
  id: serial("id").primaryKey(),
  staffId: integer("staff_id").notNull().references(() => usersTable.id),
  guestId: integer("guest_id").notNull().references(() => usersTable.id),
  action: text("action").notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ActionLog = typeof actionLogsTable.$inferSelect;
