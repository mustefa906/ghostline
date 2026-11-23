import { randomUUID } from "crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { tmpdir } from "node:os";
import { dirname, join } from "path";
import type {
  Connection,
  ConnectionInput,
  ConnectionProvider,
  ConnectionStatus,
  DismissReason,
  Draft,
  DraftInput,
  Founder,
  InterviewTurn,
  LeadInput,
  LeadStatus,
  Session,
  Store,
  StoryLead,
} from "./store";

type JsonData = {
  founders: Founder[];
  fingerprintPosts: { id: string; founderId: string; body: string; createdAt: string }[];
  sessions: Session[];
  turns: InterviewTurn[];
  drafts: Draft[];
  connections: Connection[];
  leads: StoryLead[];
};

function emptyData(): JsonData {
  return {
    founders: [],
    fingerprintPosts: [],
    sessions: [],
    turns: [],
    drafts: [],
    connections: [],
    leads: [],
  };
}

// Local JSON file store. Used when DATABASE_URL is empty or Postgres cannot
// be reached, so the app still runs end to end in development and in the
// sandbox. The file lives under data/ and is gitignored. Serverless hosts
// keep the app directory read-only, so a write that fails there moves the
// file to the system temp directory and retries once.
export class JsonStore implements Store {
  private filePath: string;
  private fellBack = false;

  constructor(filePath?: string) {
    this.filePath =
      filePath ?? join(process.cwd(), "data", "ghostline.json");
  }

  private fallbackPath(): string {
    return join(tmpdir(), "ghostline", "ghostline.json");
  }

  private read(): JsonData {
    try {
      if (!existsSync(this.filePath)) return emptyData();
      const raw = readFileSync(this.filePath, "utf-8");
      const parsed = JSON.parse(raw) as Partial<JsonData>;
      return { ...emptyData(), ...parsed };
    } catch {
      return emptyData();
    }
  }

  private write(data: JsonData): void {
    try {
      this.writeTo(this.filePath, data);
    } catch (error) {
      if (this.fellBack || this.filePath === this.fallbackPath()) {
        throw error;
      }
      this.fellBack = true;
      this.filePath = this.fallbackPath();
      this.writeTo(this.filePath, data);
    }
  }

  private writeTo(filePath: string, data: JsonData): void {
    mkdirSync(dirname(filePath), { recursive: true });
    const tmp = `${filePath}.tmp`;
    writeFileSync(tmp, JSON.stringify(data, null, 2), "utf-8");
    renameSync(tmp, filePath);
  }

  async createFounder(name: string, linkedinUrl: string | null): Promise<Founder> {
    const data = this.read();
    const founder: Founder = {
      id: randomUUID(),
      name,
      linkedinUrl,
      createdAt: new Date().toISOString(),
    };
    data.founders.push(founder);
    this.write(data);
    return founder;
  }

  async getFounder(id: string): Promise<Founder | null> {
    return this.read().founders.find((f) => f.id === id) ?? null;
  }

  async findFounderByName(name: string): Promise<Founder | null> {
    return this.read().founders.find((f) => f.name === name) ?? null;
  }

  async saveFingerprint(founderId: string, posts: string[]): Promise<void> {
    const data = this.read();
    data.fingerprintPosts = data.fingerprintPosts.filter(
      (p) => p.founderId !== founderId,
    );
    for (const body of posts) {
      data.fingerprintPosts.push({
        id: randomUUID(),
        founderId,
        body,
        createdAt: new Date().toISOString(),
      });
    }
    this.write(data);
  }

  async getFingerprint(founderId: string): Promise<string[]> {
    return this.read()
      .fingerprintPosts.filter((p) => p.founderId === founderId)
      .map((p) => p.body);
  }

  async createSession(founderId: string, transcript: string): Promise<Session> {
    const data = this.read();
    const session: Session = {
      id: randomUUID(),
      founderId,
      transcript,
      status: "recording",
      createdAt: new Date().toISOString(),
    };
    data.sessions.push(session);
    this.write(data);
    return session;
  }

  async updateSession(
    id: string,
    patch: { transcript?: string; status?: string },
  ): Promise<Session | null> {
    const data = this.read();
    const session = data.sessions.find((s) => s.id === id);
    if (!session) return null;
    if (patch.transcript !== undefined) session.transcript = patch.transcript;
    if (patch.status !== undefined) session.status = patch.status;
    this.write(data);
    return session;
  }

  async getSession(id: string): Promise<Session | null> {
    return this.read().sessions.find((s) => s.id === id) ?? null;
  }

  async addTurn(
    sessionId: string,
    role: "agent" | "founder",
    body: string,
    kind?: string,
  ): Promise<InterviewTurn> {
    const data = this.read();
    const turn: InterviewTurn = {
      id: randomUUID(),
      sessionId,
      role,
      body,
      kind: kind ?? null,
      createdAt: new Date().toISOString(),
    };
    data.turns.push(turn);
    this.write(data);
    return turn;
  }

  async getTurns(sessionId: string): Promise<InterviewTurn[]> {
    return this.read().turns.filter((t) => t.sessionId === sessionId);
  }

  async createDraft(input: DraftInput): Promise<Draft> {
    const data = this.read();
    const draft: Draft = {
      id: randomUUID(),
      sessionId: input.sessionId,
      founderId: input.founderId,
      body: input.body,
      sourceNote: input.sourceNote,
      version: input.version,
      editedBody: null,
      status: "draft",
      scheduledFor: input.scheduledFor ?? null,
      createdAt: new Date().toISOString(),
    };
    data.drafts.push(draft);
    this.write(data);
    return draft;
  }

  async updateDraft(
    id: string,
    patch: {
      editedBody?: string | null;
      status?: string;
      scheduledFor?: string | null;
    },
  ): Promise<Draft | null> {
    const data = this.read();
    const draft = data.drafts.find((d) => d.id === id);
    if (!draft) return null;
    if (patch.editedBody !== undefined) draft.editedBody = patch.editedBody;
    if (patch.status !== undefined) draft.status = patch.status;
    if (patch.scheduledFor !== undefined) draft.scheduledFor = patch.scheduledFor;
    this.write(data);
    return draft;
  }

  async getDraft(id: string): Promise<Draft | null> {
    return this.read().drafts.find((d) => d.id === id) ?? null;
  }

  async listDrafts(founderId: string): Promise<Draft[]> {
    return this.read()
      .drafts.filter((d) => d.founderId === founderId)
      .sort((a, b) => {
        const aKey = a.scheduledFor ?? a.createdAt;
        const bKey = b.scheduledFor ?? b.createdAt;
        return aKey.localeCompare(bKey);
      });
  }

  async deleteDraft(id: string): Promise<boolean> {
    const data = this.read();
    const before = data.drafts.length;
    data.drafts = data.drafts.filter((d) => d.id !== id);
    if (data.drafts.length === before) return false;
    this.write(data);
    return true;
  }

  // Saving a connection for a provider the founder already connected
  // replaces the stored tokens instead of adding a second row.
  async saveConnection(input: ConnectionInput): Promise<Connection> {
    const data = this.read();
    const now = new Date().toISOString();
    const match = data.connections.find(
      (c) => c.founderId === input.founderId && c.provider === input.provider,
    );
    if (match) {
      match.accountLabel = input.accountLabel;
      match.accessTokenEncrypted = input.accessTokenEncrypted;
      match.refreshTokenEncrypted = input.refreshTokenEncrypted;
      match.tokenExpiresAt = input.tokenExpiresAt;
      match.status = "active";
      match.updatedAt = now;
      this.write(data);
      return match;
    }
    const connection: Connection = {
      id: randomUUID(),
      founderId: input.founderId,
      provider: input.provider,
      accountLabel: input.accountLabel,
      accessTokenEncrypted: input.accessTokenEncrypted,
      refreshTokenEncrypted: input.refreshTokenEncrypted,
      tokenExpiresAt: input.tokenExpiresAt,
      status: "active",
      createdAt: now,
      updatedAt: now,
    };
    data.connections.push(connection);
    this.write(data);
    return connection;
  }

  async updateConnection(
    id: string,
    patch: {
      status?: ConnectionStatus;
      accountLabel?: string;
      accessTokenEncrypted?: string;
      refreshTokenEncrypted?: string;
      tokenExpiresAt?: string | null;
    },
  ): Promise<Connection | null> {
    const data = this.read();
    const connection = data.connections.find((c) => c.id === id);
    if (!connection) return null;
    if (patch.status !== undefined) connection.status = patch.status;
    if (patch.accountLabel !== undefined)
      connection.accountLabel = patch.accountLabel;
    if (patch.accessTokenEncrypted !== undefined)
      connection.accessTokenEncrypted = patch.accessTokenEncrypted;
    if (patch.refreshTokenEncrypted !== undefined)
      connection.refreshTokenEncrypted = patch.refreshTokenEncrypted;
    if (patch.tokenExpiresAt !== undefined)
      connection.tokenExpiresAt = patch.tokenExpiresAt;
    connection.updatedAt = new Date().toISOString();
    this.write(data);
    return connection;
  }

  async getConnections(founderId: string): Promise<Connection[]> {
    return this.read().connections.filter((c) => c.founderId === founderId);
  }

  // Deleting a connection also deletes the leads that came from it.
  async deleteConnection(
    founderId: string,
    provider: ConnectionProvider,
  ): Promise<boolean> {
    const data = this.read();
    const before = data.connections.length;
    data.connections = data.connections.filter(
      (c) => !(c.founderId === founderId && c.provider === provider),
    );
    if (data.connections.length === before) return false;
    const sourceType = provider === "google" ? "calendar" : "hubspot";
    data.leads = data.leads.filter(
      (l) => !(l.founderId === founderId && l.sourceType === sourceType),
    );
    this.write(data);
    return true;
  }

  async createLeads(leads: LeadInput[]): Promise<StoryLead[]> {
    const data = this.read();
    const created: StoryLead[] = leads.map((l) => ({
      id: randomUUID(),
      founderId: l.founderId,
      sourceType: l.sourceType,
      sourceRef: l.sourceRef,
      sourceLabel: l.sourceLabel,
      title: l.title,
      whatHappened: l.whatHappened,
      angle: l.angle,
      openingQuestion: l.openingQuestion,
      score: l.score,
      status: "new",
      dismissReason: null,
      weekOf: l.weekOf,
      createdAt: new Date().toISOString(),
    }));
    data.leads.push(...created);
    this.write(data);
    return created;
  }

  async listLeads(
    founderId: string,
    weekOf: string,
  ): Promise<StoryLead[]> {
    return this.read().leads.filter(
      (l) => l.founderId === founderId && l.weekOf === weekOf,
    );
  }

  async updateLead(
    id: string,
    patch: {
      status?: LeadStatus;
      dismissReason?: DismissReason | null;
    },
  ): Promise<StoryLead | null> {
    const data = this.read();
    const lead = data.leads.find((l) => l.id === id);
    if (!lead) return null;
    if (patch.status !== undefined) lead.status = patch.status;
    if (patch.dismissReason !== undefined)
      lead.dismissReason = patch.dismissReason;
    this.write(data);
    return lead;
  }
}
