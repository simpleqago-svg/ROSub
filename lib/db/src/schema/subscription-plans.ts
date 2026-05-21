import { pgTable, text, serial, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const subscriptionPlansTable = pgTable("subscription_plans", {
  id: serial("id").primaryKey(),
  nameRu: text("name_ru").notNull(),
  nameRs: text("name_rs").notNull(),
  level: integer("level").notNull(),
  hookahCount: integer("hookah_count").notNull(),
  priceRsd: integer("price_rsd").notNull(),
  pricePerHookah: integer("price_per_hookah").notNull(),
  bonusHookahFruit: integer("bonus_hookah_fruit").notNull().default(0),
  bonusElectric: integer("bonus_electric").notNull().default(0),
  bonusHookahCheap: integer("bonus_hookah_cheap").notNull().default(1),
});

export const insertSubscriptionPlanSchema = createInsertSchema(subscriptionPlansTable).omit({ id: true });
export type InsertSubscriptionPlan = z.infer<typeof insertSubscriptionPlanSchema>;
export type SubscriptionPlan = typeof subscriptionPlansTable.$inferSelect;
