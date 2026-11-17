import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const founders = pgTable("founders", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  linkedinUrl: text("linkedin_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const fingerprintPosts = pgTable("fingerprint_posts", {
  id: uuid("id").defaultRandom().primaryKey(),
  founderId: uuid("founder_id")
    .notNull()
    .references(() => founders.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  founderId: uuid("founder_id")
    .notNull()
    .references(() => founders.id, { onDelete: "cascade" }),
  transcript: text("transcript").notNull().default(""),
  status: text("status").notNull().default("recording"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const interviewTurns = pgTable("interview_turns", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  body: text("body").notNull(),
  kind: text("kind"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const drafts = pgTable("drafts", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionId: uuid("session_id").references(() => sessions.id, {
    onDelete: "set null",
  }),
  founderId: uuid("founder_id")
    .notNull()
    .references(() => founders.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  sourceNote: text("source_note").notNull().default(""),
  version: text("version").notNull().default("original"),
  editedBody: text("edited_body"),
  status: text("status").notNull().default("draft"),
  scheduledFor: timestamp("scheduled_for"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
