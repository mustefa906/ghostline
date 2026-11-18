import { randomUUID } from "crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { tmpdir } from "node:os";
import { dirname, join } from "path";
import type {
  Draft,
  DraftInput,
  Founder,
  InterviewTurn,
  Session,
  Store,
} from "./store";

type JsonData = {
  founders: Founder[];
  fingerprintPosts: { id: string; founderId: string; body: string; createdAt: string }[];
  sessions: Session[];
  turns: InterviewTurn[];
  drafts: Draft[];
};

function emptyData(): JsonData {
  return {
    founders: [],
    fingerprintPosts: [],
    sessions: [],
    turns: [],
    drafts: [],
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
}
