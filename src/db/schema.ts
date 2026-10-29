import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { MONTH_STATUSES, ROLES, SLOT_ROLES, SLOT_SOURCES, SWAP_KINDS, SWAP_STATUSES, THEMES } from "@/lib/roles";

export const roleEnum = pgEnum("role", ROLES);
export const slotRoleEnum = pgEnum("slot_role", SLOT_ROLES);
export const monthStatusEnum = pgEnum("month_status", MONTH_STATUSES);
export const themeEnum = pgEnum("theme", THEMES);
export const slotSourceEnum = pgEnum("slot_source", SLOT_SOURCES);
export const swapKindEnum = pgEnum("swap_kind", SWAP_KINDS);
export const swapStatusEnum = pgEnum("swap_status", SWAP_STATUSES);

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const volunteers = pgTable("volunteers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  active: boolean("active").notNull().default(true),
  posterOrder: integer("poster_order"),
  createdAt: createdAt(),
});

export const volunteerRoles = pgTable(
  "volunteer_roles",
  {
    volunteerId: integer("volunteer_id")
      .notNull()
      .references(() => volunteers.id, { onDelete: "cascade" }),
    role: roleEnum("role").notNull(),
  },
  (t) => [primaryKey({ columns: [t.volunteerId, t.role] })],
);

export const months = pgTable(
  "months",
  {
    id: serial("id").primaryKey(),
    year: integer("year").notNull(),
    month: integer("month").notNull(),
    deadline: timestamp("deadline", { withTimezone: true }).notNull(),
    status: monthStatusEnum("status").notNull().default("open"),
    posterVolunteerId: integer("poster_volunteer_id").references(() => volunteers.id, { onDelete: "set null" }),
    theme: themeEnum("theme").notNull().default("teal"),
    autofillSeed: integer("autofill_seed"),
    notes: text("notes").notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("months_year_month").on(t.year, t.month)],
);

export const serviceDates = pgTable(
  "service_dates",
  {
    id: serial("id").primaryKey(),
    monthId: integer("month_id")
      .notNull()
      .references(() => months.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
  },
  (t) => [uniqueIndex("service_dates_month_date").on(t.monthId, t.date)],
);

export const slots = pgTable(
  "slots",
  {
    id: serial("id").primaryKey(),
    serviceDateId: integer("service_date_id")
      .notNull()
      .references(() => serviceDates.id, { onDelete: "cascade" }),
    role: slotRoleEnum("role").notNull(),
    volunteerId: integer("volunteer_id").references(() => volunteers.id, { onDelete: "set null" }),
    source: slotSourceEnum("source"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("slots_date_role").on(t.serviceDateId, t.role),
    // One role per person per Sunday, enforced by the database as well as the app.
    uniqueIndex("slots_one_role_per_day")
      .on(t.serviceDateId, t.volunteerId)
      .where(sql`${t.volunteerId} is not null`),
  ],
);

export const swapRequests = pgTable(
  "swap_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: swapKindEnum("kind").notNull(),
    requesterId: integer("requester_id")
      .notNull()
      .references(() => volunteers.id, { onDelete: "cascade" }),
    targetId: integer("target_id")
      .notNull()
      .references(() => volunteers.id, { onDelete: "cascade" }),
    requesterSlotId: integer("requester_slot_id")
      .notNull()
      .references(() => slots.id, { onDelete: "cascade" }),
    targetSlotId: integer("target_slot_id").references(() => slots.id, { onDelete: "cascade" }),
    status: swapStatusEnum("status").notNull().default("pending"),
    reason: text("reason"),
    // Code for the short share link /s/<code>; null on requests made before short links.
    shortCode: text("short_code"),
    createdAt: createdAt(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("swap_pending_requester_slot").on(t.requesterSlotId).where(sql`${t.status} = 'pending'`),
    uniqueIndex("swap_pending_target_slot").on(t.targetSlotId).where(sql`${t.status} = 'pending'`),
    uniqueIndex("swap_requests_short_code").on(t.shortCode),
  ],
);

export const organiserAttempts = pgTable("organiser_attempts", {
  ipHash: text("ip_hash").primaryKey(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  count: integer("count").notNull().default(0),
});
