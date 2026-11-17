import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { JsonStore } from "../lib/json-store";

describe("JSON file store", () => {
  let dir: string;
  let store: JsonStore;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "ghostline-test-"));
    store = new JsonStore(join(dir, "ghostline.json"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("creates a founder and reads it back", async () => {
    const founder = await store.createFounder("Sab Ali", null);
    expect(founder.name).toBe("Sab Ali");
    expect(await store.getFounder(founder.id)).toEqual(founder);
    expect(await store.getFounder("missing")).toBeNull();
  });

  it("replaces the fingerprint and warns nothing by itself", async () => {
    const founder = await store.createFounder("Sab Ali", null);
    await store.saveFingerprint(founder.id, ["post one", "post two"]);
    expect(await store.getFingerprint(founder.id)).toEqual([
      "post one",
      "post two",
    ]);
    await store.saveFingerprint(founder.id, ["post three"]);
    expect(await store.getFingerprint(founder.id)).toEqual(["post three"]);
  });

  it("runs a full session, turns, and draft round trip", async () => {
    const founder = await store.createFounder("Sab Ali", null);
    const session = await store.createSession(founder.id, "We lost a client.");
    await store.addTurn(session.id, "agent", "What went wrong?", "question");
    await store.addTurn(session.id, "founder", "Nobody owned week one.");
    const turns = await store.getTurns(session.id);
    expect(turns).toHaveLength(2);
    expect(turns[0].kind).toBe("question");

    const draft = await store.createDraft({
      sessionId: session.id,
      founderId: founder.id,
      body: "We lost a client.",
      sourceNote: "Paragraph 1 came from the transcript.",
      version: "original",
      scheduledFor: null,
    });
    expect(draft.status).toBe("draft");
    const updated = await store.updateDraft(draft.id, {
      editedBody: "We lost a client. Then we fixed week one.",
      status: "queued",
      scheduledFor: new Date("2026-11-20T09:00:00Z").toISOString(),
    });
    expect(updated?.editedBody).toContain("fixed week one");
    expect(updated?.status).toBe("queued");

    const list = await store.listDrafts(founder.id);
    expect(list).toHaveLength(1);
    expect(await store.deleteDraft(draft.id)).toBe(true);
    expect(await store.listDrafts(founder.id)).toHaveLength(0);
  });

  it("finds a founder by name", async () => {
    await store.createFounder("Maya Chen", null);
    const found = await store.findFounderByName("Maya Chen");
    expect(found?.name).toBe("Maya Chen");
    expect(await store.findFounderByName("Nobody")).toBeNull();
  });
});
