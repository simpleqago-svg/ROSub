import { pgTable, serial, integer, boolean, timestamp, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { subscriptionPlansTable } from "./subscription-plans";

export const userSubscriptionsTable = pgTable("user_subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  planId: integer("plan_id").notNull().references(() => subscriptionPlansTable.id),
  hookahsRemaining: integer("hookahs_remaining").notNull(),
  fruitHookahsRemaining: integer("fruit_hookahs_remaining").notNull().default(0),
  electricAvailable: boolean("electric_available").notNull().default(false),
  cheapHookahAvailable: boolean("cheap_hookah_available").notNull().default(true),
  totalHookahsUsed: integer("total_hookahs_used").notNull().default(0),
  activatedAt: timestamp("activated_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  frozenUntil: timestamp("frozen_until", { withTimezone: true }),
  note: text("note"),
  active: boolean("active").notNull().default(true),
  isLegacy: boolean("is_legacy").notNull().default(false),
});

export const insertUserSubscriptionSchema = createInsertSchema(userSubscriptionsTable).omit({ id: true, activatedAt: true });
export type InsertUserSubscription = z.infer<typeof insertUserSubscriptionSchema>;
export type UserSubscription = typeof userSubscriptionsTable.$inferSelect;
