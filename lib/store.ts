import { asc, eq } from "drizzle-orm";
import { tryPostgres, type Db } from "./db";
import { JsonStore } from "./json-store";
import {
  drafts,
  fingerprintPosts,
  founders,
  interviewTurns,
  sessions,
} from "./schema";

export type Founder = {
  id: string;
  name: string;
  linkedinUrl: string | null;
  createdAt: string;
};

export type Session = {
  id: string;
  founderId: string;
  transcript: string;
  status: string;
  createdAt: string;
};

export type InterviewTurn = {
  id: string;
  sessionId: string;
  role: "agent" | "founder";
  body: string;
  kind: string | null;
  createdAt: string;
};

export type DraftInput = {
  sessionId: string | null;
  founderId: string;
  body: string;
  sourceNote: string;
  version: string;
  scheduledFor?: string | null;
};

export type Draft = {
  id: string;
  sessionId: string | null;
  founderId: string;
  body: string;
  sourceNote: string;
  version: string;
  editedBody: string | null;
  status: string;
  scheduledFor: string | null;
  createdAt: string;
};

export interface Store {
  createFounder(name: string, linkedinUrl: string | null): Promise<Founder>;
  getFounder(id: string): Promise<Founder | null>;
  findFounderByName(name: string): Promise<Founder | null>;
  saveFingerprint(founderId: string, posts: string[]): Promise<void>;
  getFingerprint(founderId: string): Promise<string[]>;
  createSession(founderId: string, transcript: string): Promise<Session>;
  updateSession(
    id: string,
    patch: { transcript?: string; status?: string },
  ): Promise<Session | null>;
  getSession(id: string): Promise<Session | null>;
  addTurn(
    sessionId: string,
    role: "agent" | "founder",
    body: string,
    kind?: string,
  ): Promise<InterviewTurn>;
  getTurns(sessionId: string): Promise<InterviewTurn[]>;
  createDraft(input: DraftInput): Promise<Draft>;
  updateDraft(
    id: string,
    patch: {
      editedBody?: string | null;
      status?: string;
      scheduledFor?: string | null;
    },
  ): Promise<Draft | null>;
  getDraft(id: string): Promise<Draft | null>;
  listDrafts(founderId: string): Promise<Draft[]>;
  deleteDraft(id: string): Promise<boolean>;
}

// Postgres implementation. Dates come back as Date objects from node-postgres,
// so every read normalises them to ISO strings.
class PostgresStore implements Store {
  constructor(private db: Db) {}

  private toFounder(row: typeof founders.$inferSelect): Founder {
    return {
      id: row.id,
      name: row.name,
      linkedinUrl: row.linkedinUrl,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async createFounder(name: string, linkedinUrl: string | null): Promise<Founder> {
    const [row] = await this.db
      .insert(founders)
      .values({ name, linkedinUrl })
      .returning();
    return this.toFounder(row);
  }

  async getFounder(id: string): Promise<Founder | null> {
    const rows = await this.db
      .select()
      .from(founders)
      .where(eq(founders.id, id))
      .limit(1);
    return rows.length ? this.toFounder(rows[0]) : null;
  }

  async findFounderByName(name: string): Promise<Founder | null> {
    const rows = await this.db
      .select()
      .from(founders)
      .where(eq(founders.name, name))
      .limit(1);
    return rows.length ? this.toFounder(rows[0]) : null;
  }

  async saveFingerprint(founderId: string, posts: string[]): Promise<void> {
    await this.db
      .delete(fingerprintPosts)
      .where(eq(fingerprintPosts.founderId, founderId));
    if (posts.length) {
      await this.db
        .insert(fingerprintPosts)
        .values(posts.map((body) => ({ founderId, body })));
    }
  }

  async getFingerprint(founderId: string): Promise<string[]> {
    const rows = await this.db
      .select()
      .from(fingerprintPosts)
      .where(eq(fingerprintPosts.founderId, founderId))
      .orderBy(asc(fingerprintPosts.createdAt));
    return rows.map((r) => r.body);
  }

  async createSession(founderId: string, transcript: string): Promise<Session> {
    const [row] = await this.db
      .insert(sessions)
      .values({ founderId, transcript })
      .returning();
    return {
      id: row.id,
      founderId: row.founderId,
      transcript: row.transcript,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async updateSession(
    id: string,
    patch: { transcript?: string; status?: string },
  ): Promise<Session | null> {
    const [row] = await this.db
      .update(sessions)
      .set(patch)
      .where(eq(sessions.id, id))
      .returning();
    if (!row) return null;
    return {
      id: row.id,
      founderId: row.founderId,
      transcript: row.transcript,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async getSession(id: string): Promise<Session | null> {
    const rows = await this.db
      .select()
      .from(sessions)
      .where(eq(sessions.id, id))
      .limit(1);
    if (!rows.length) return null;
    const row = rows[0];
    return {
      id: row.id,
      founderId: row.founderId,
      transcript: row.transcript,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async addTurn(
    sessionId: string,
    role: "agent" | "founder",
    body: string,
    kind?: string,
  ): Promise<InterviewTurn> {
    const [row] = await this.db
      .insert(interviewTurns)
      .values({ sessionId, role, body, kind: kind ?? null })
      .returning();
    return {
      id: row.id,
      sessionId: row.sessionId,
      role: row.role as "agent" | "founder",
      body: row.body,
      kind: row.kind,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async getTurns(sessionId: string): Promise<InterviewTurn[]> {
    const rows = await this.db
      .select()
      .from(interviewTurns)
      .where(eq(interviewTurns.sessionId, sessionId))
      .orderBy(asc(interviewTurns.createdAt));
    return rows.map((row) => ({
      id: row.id,
      sessionId: row.sessionId,
      role: row.role as "agent" | "founder",
      body: row.body,
      kind: row.kind,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async createDraft(input: DraftInput): Promise<Draft> {
    const [row] = await this.db
      .insert(drafts)
      .values({
        sessionId: input.sessionId,
        founderId: input.founderId,
        body: input.body,
        sourceNote: input.sourceNote,
        version: input.version,
        scheduledFor: input.scheduledFor
          ? new Date(input.scheduledFor)
          : null,
      })
      .returning();
    return this.toDraft(row);
  }

  async updateDraft(
    id: string,
    patch: {
      editedBody?: string | null;
      status?: string;
      scheduledFor?: string | null;
    },
  ): Promise<Draft | null> {
    const values: {
      editedBody?: string | null;
      status?: string;
      scheduledFor?: Date | null;
    } = {};
    if (patch.editedBody !== undefined) values.editedBody = patch.editedBody;
    if (patch.status !== undefined) values.status = patch.status;
    if (patch.scheduledFor !== undefined) {
      values.scheduledFor = patch.scheduledFor
        ? new Date(patch.scheduledFor)
        : null;
    }
    const [row] = await this.db
      .update(drafts)
      .set(values)
      .where(eq(drafts.id, id))
      .returning();
    return row ? this.toDraft(row) : null;
  }

  async getDraft(id: string): Promise<Draft | null> {
    const rows = await this.db
      .select()
      .from(drafts)
      .where(eq(drafts.id, id))
      .limit(1);
    return rows.length ? this.toDraft(rows[0]) : null;
  }

  async listDrafts(founderId: string): Promise<Draft[]> {
    const rows = await this.db
      .select()
      .from(drafts)
      .where(eq(drafts.founderId, founderId))
      .orderBy(asc(drafts.scheduledFor), asc(drafts.createdAt));
    return rows.map((r) => this.toDraft(r));
  }

  async deleteDraft(id: string): Promise<boolean> {
    const rows = await this.db
      .delete(drafts)
      .where(eq(drafts.id, id))
      .returning({ id: drafts.id });
    return rows.length > 0;
  }

  private toDraft(row: typeof drafts.$inferSelect): Draft {
    return {
      id: row.id,
      sessionId: row.sessionId,
      founderId: row.founderId,
      body: row.body,
      sourceNote: row.sourceNote,
      version: row.version,
      editedBody: row.editedBody,
      status: row.status,
      scheduledFor: row.scheduledFor
        ? row.scheduledFor.toISOString()
        : null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}

let storePromise: Promise<Store> | null = null;
let storeKind: "postgres" | "json" = "json";

export function getStoreKind(): "postgres" | "json" {
  return storeKind;
}

// Tries Postgres first when DATABASE_URL is set. Any failure falls back to
// the local JSON file store, so the app still runs end to end with no
// database available.
export function getStore(): Promise<Store> {
  if (!storePromise) {
    storePromise = (async (): Promise<Store> => {
      const url = process.env.DATABASE_URL;
      if (url) {
        try {
          const db = await tryPostgres(url);
          storeKind = "postgres";
          return new PostgresStore(db);
        } catch {
          console.warn(
            "Ghostline: Postgres was unreachable, using the local JSON store instead.",
          );
        }
      }
      storeKind = "json";
      return new JsonStore();
    })();
  }
  return storePromise;
}
