import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

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

// One row per founder per connected source. Tokens are stored encrypted;
// the plaintext never reaches the database.
export const connections = pgTable("connections", {
  id: uuid("id").defaultRandom().primaryKey(),
  founderId: uuid("founder_id")
    .notNull()
    .references(() => founders.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  accountLabel: text("account_label").notNull().default(""),
  accessTokenEncrypted: text("access_token_encrypted").notNull(),
  refreshTokenEncrypted: text("refresh_token_encrypted").notNull(),
  tokenExpiresAt: timestamp("token_expires_at"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// One story lead per row. weekOf holds the Monday of the week as YYYY-MM-DD.
export const storyLeads = pgTable("story_leads", {
  id: uuid("id").defaultRandom().primaryKey(),
  founderId: uuid("founder_id")
    .notNull()
    .references(() => founders.id, { onDelete: "cascade" }),
  sourceType: text("source_type").notNull(),
  sourceRef: text("source_ref").notNull(),
  sourceLabel: text("source_label").notNull(),
  title: text("title").notNull(),
  whatHappened: text("what_happened").notNull(),
  angle: text("angle").notNull(),
  openingQuestion: text("opening_question").notNull(),
  score: integer("score").notNull().default(1),
  status: text("status").notNull().default("new"),
  dismissReason: text("dismiss_reason"),
  weekOf: text("week_of").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
