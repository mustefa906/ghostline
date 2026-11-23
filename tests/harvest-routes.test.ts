import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { getWeekMonday } from "../lib/harvest";
import { buildOAuthState } from "../lib/connections";
import { getStore } from "../lib/store";
import { GET as listLeads } from "../app/api/leads/route";
import { POST as harvestLeads } from "../app/api/leads/harvest/route";
import { PATCH as updateLead } from "../app/api/leads/[id]/route";
import { GET as listConnections } from "../app/api/connections/route";
import { POST as startGoogle } from "../app/api/connections/google/route";
import { GET as googleCallback } from "../app/api/connections/google/callback/route";
import { POST as startHubSpot } from "../app/api/connections/hubspot/route";
import { DELETE as deleteConnection } from "../app/api/connections/[provider]/route";
import { POST as interview } from "../app/api/interview/route";

// Route tests. The store resolves through getStore(), which uses the JSON
// file store when no DATABASE_URL is set. The file runs in one temp
// working directory, so the file store lands under that directory and
// never touches the repo's data/ folder. No test calls a live API.

describe("leads routes", () => {
  let dir: string;
  let originalCwd: string;
  let founderId: string;

  beforeAll(() => {
    originalCwd = process.cwd();
    dir = mkdtempSync(join(tmpdir(), "ghostline-routes-test-"));
    process.chdir(dir);
  });

  afterAll(() => {
    process.chdir(originalCwd);
    rmSync(dir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    const store = await getStore();
    const founder = await store.createFounder("Sab Ali", null);
    founderId = founder.id;
  });

  function postJson(url: string, body: unknown): NextRequest {
    return new NextRequest(`http://localhost${url}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("returns an empty week when nothing is stored", async () => {
    const res = await listLeads(
      new NextRequest(
        `http://localhost/api/leads?founderId=${founderId}&week=${getWeekMonday()}`,
      ),
    );
    const data = (await res.json()) as { leads: unknown[] };
    expect(res.status).toBe(200);
    expect(data.leads).toEqual([]);
  });

  it("requires a founder id on the list route", async () => {
    const res = await listLeads(
      new NextRequest("http://localhost/api/leads"),
    );
    expect(res.status).toBe(400);
  });

  it("returns the fresh leads it already stored, without a new harvest", async () => {
    const store = await getStore();
    await store.createLeads([
      {
        founderId,
        sourceType: "calendar",
        sourceRef: "event-1",
        sourceLabel: "Sales call, Tue Nov 24",
        title: "The call that ran long",
        whatHappened: "A sales call ran 20 minutes over.",
        angle: "The objection that almost ended it.",
        openingQuestion: "What was the objection?",
        score: 2,
        weekOf: getWeekMonday(),
      },
    ]);
    const res = await harvestLeads(postJson("/api/leads/harvest", { founderId }));
    const data = (await res.json()) as {
      leads: { title: string }[];
    };
    expect(res.status).toBe(200);
    expect(data.leads).toHaveLength(1);
    expect(data.leads[0].title).toBe("The call that ran long");
  });

  it("returns a plain 503 when the Anthropic key is missing", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const res = await harvestLeads(
      postJson("/api/leads/harvest", { founderId, demo: true }),
    );
    expect(res.status).toBe(503);
    const data = (await res.json()) as { error: string };
    expect(data.error).toContain("Anthropic key");
  });

  it("returns an empty harvest when there is nothing to read", async () => {
    const res = await harvestLeads(postJson("/api/leads/harvest", { founderId }));
    const data = (await res.json()) as {
      leads: unknown[];
      connected: boolean;
    };
    expect(res.status).toBe(200);
    expect(data.leads).toEqual([]);
    expect(data.connected).toBe(false);
  });

  it("expires fresh leads on refresh and returns the empty week", async () => {
    const store = await getStore();
    const [lead] = await store.createLeads([
      {
        founderId,
        sourceType: "calendar",
        sourceRef: "event-1",
        sourceLabel: "Sales call, Tue Nov 24",
        title: "The call that ran long",
        whatHappened: "A sales call ran 20 minutes over.",
        angle: "The objection that almost ended it.",
        openingQuestion: "What was the objection?",
        score: 2,
        weekOf: getWeekMonday(),
      },
    ]);
    const res = await harvestLeads(
      postJson("/api/leads/harvest", { founderId, refresh: true }),
    );
    const data = (await res.json()) as { leads: unknown[] };
    expect(res.status).toBe(200);
    expect(data.leads).toEqual([]);
    const after = await store.listLeads(founderId, getWeekMonday());
    expect(after[0].id).toBe(lead.id);
    expect(after[0].status).toBe("expired");
  });

  it("dismisses a lead with its reason and marks a lead used", async () => {
    const store = await getStore();
    const [lead] = await store.createLeads([
      {
        founderId,
        sourceType: "calendar",
        sourceRef: "event-1",
        sourceLabel: "Sales call, Tue Nov 24",
        title: "The call that ran long",
        whatHappened: "A sales call ran 20 minutes over.",
        angle: "The objection that almost ended it.",
        openingQuestion: "What was the objection?",
        score: 2,
        weekOf: getWeekMonday(),
      },
    ]);
    const dismissRes = await updateLead(
      new NextRequest(`http://localhost/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "dismissed",
          dismissReason: "too sensitive",
        }),
      }),
      { params: Promise.resolve({ id: lead.id }) },
    );
    const dismissed = (await dismissRes.json()) as {
      lead: { status: string; dismissReason: string };
    };
    expect(dismissRes.status).toBe(200);
    expect(dismissed.lead.status).toBe("dismissed");
    expect(dismissed.lead.dismissReason).toBe("too sensitive");

    const usedRes = await updateLead(
      new NextRequest(`http://localhost/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "used" }),
      }),
      { params: Promise.resolve({ id: lead.id }) },
    );
    const used = (await usedRes.json()) as {
      lead: { status: string };
    };
    expect(used.lead.status).toBe("used");
  });

  it("rejects a dismiss with no reason and a missing lead", async () => {
    const store = await getStore();
    const [lead] = await store.createLeads([
      {
        founderId,
        sourceType: "calendar",
        sourceRef: "event-1",
        sourceLabel: "Sales call, Tue Nov 24",
        title: "The call that ran long",
        whatHappened: "A sales call ran 20 minutes over.",
        angle: "The objection that almost ended it.",
        openingQuestion: "What was the objection?",
        score: 2,
        weekOf: getWeekMonday(),
      },
    ]);
    const noReason = await updateLead(
      new NextRequest(`http://localhost/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "dismissed" }),
      }),
      { params: Promise.resolve({ id: lead.id }) },
    );
    expect(noReason.status).toBe(400);
    const missing = await updateLead(
      new NextRequest("http://localhost/api/leads/missing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "used" }),
      }),
      { params: Promise.resolve({ id: "missing" }) },
    );
    expect(missing.status).toBe(404);
  });

  it("does not offer a used lead again as a fresh lead", async () => {
    const store = await getStore();
    await store.createLeads([
      {
        founderId,
        sourceType: "calendar",
        sourceRef: "event-1",
        sourceLabel: "Sales call, Tue Nov 24",
        title: "The call that ran long",
        whatHappened: "A sales call ran 20 minutes over.",
        angle: "The objection that almost ended it.",
        openingQuestion: "What was the objection?",
        score: 2,
        weekOf: getWeekMonday(),
      },
    ]);
    const leads = await store.listLeads(founderId, getWeekMonday());
    await store.updateLead(leads[0].id, { status: "used" });
    const res = await harvestLeads(postJson("/api/leads/harvest", { founderId }));
    const data = (await res.json()) as { leads: unknown[] };
    expect(res.status).toBe(200);
    expect(data.leads).toEqual([]);
  });
});

describe("connections routes", () => {
  let founderId: string;

  beforeEach(async () => {
    const store = await getStore();
    const founder = await store.createFounder("Sab Ali", null);
    founderId = founder.id;
    process.env.TOKEN_ENCRYPTION_KEY = "test-key-for-harvest";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.TOKEN_ENCRYPTION_KEY;
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.HUBSPOT_CLIENT_ID;
    delete process.env.HUBSPOT_CLIENT_SECRET;
  });

  function postJson(url: string, body: unknown): NextRequest {
    return new NextRequest(`http://localhost${url}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("lists no connections at first and requires a founder id", async () => {
    const res = await listConnections(
      new NextRequest(
        `http://localhost/api/connections?founderId=${founderId}`,
      ),
    );
    const data = (await res.json()) as { connections: unknown[] };
    expect(res.status).toBe(200);
    expect(data.connections).toEqual([]);
    expect(
      await listConnections(new NextRequest("http://localhost/api/connections")),
    ).toHaveProperty("status", 400);
  });

  it("returns a plain 503 when the Google client id is missing", async () => {
    const res = await startGoogle(
      postJson("/api/connections/google", { founderId }),
    );
    expect(res.status).toBe(503);
    const data = (await res.json()) as { error: string };
    expect(data.error).toContain("GOOGLE_CLIENT_ID");
  });

  it("returns the Google and HubSpot authorization URLs", async () => {
    process.env.GOOGLE_CLIENT_ID = "google-id";
    process.env.HUBSPOT_CLIENT_ID = "hubspot-id";
    const googleRes = await startGoogle(
      postJson("/api/connections/google", { founderId }),
    );
    const googleData = (await googleRes.json()) as { url: string };
    expect(googleRes.status).toBe(200);
    expect(googleData.url).toContain("accounts.google.com");
    expect(googleData.url).toContain("calendar.readonly");
    const hubspotRes = await startHubSpot(
      postJson("/api/connections/hubspot", { founderId }),
    );
    const hubspotData = (await hubspotRes.json()) as { url: string };
    expect(hubspotRes.status).toBe(200);
    expect(hubspotData.url).toContain("app.hubspot.com");
    expect(hubspotData.url).toContain("crm.objects.deals.read");
  });

  it("stores a connection through the Google callback", async () => {
    process.env.GOOGLE_CLIENT_ID = "google-id";
    process.env.GOOGLE_CLIENT_SECRET = "google-secret";
    vi.stubGlobal(
      "fetch",
      async (input: string) => {
        if (input.includes("oauth2.googleapis.com/token")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              access_token: "access-123",
              refresh_token: "refresh-123",
              expires_in: 3600,
            }),
            text: async () => "",
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ email: "sab@example.com" }),
          text: async () => "",
        };
      },
    );
    const state = buildOAuthState(founderId, "google");
    const res = await googleCallback(
      new NextRequest(
        `http://localhost/api/connections/google/callback?code=auth-code&state=${state}`,
      ),
    );
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("connected=google");
    const list = await listConnections(
      new NextRequest(
        `http://localhost/api/connections?founderId=${founderId}`,
      ),
    );
    const data = (await list.json()) as {
      connections: {
        provider: string;
        accountLabel: string;
        status: string;
        accessTokenEncrypted?: string;
      }[];
    };
    expect(data.connections).toHaveLength(1);
    expect(data.connections[0].provider).toBe("google");
    expect(data.connections[0].accountLabel).toBe("sab@example.com");
    expect(data.connections[0].status).toBe("active");
    expect(data.connections[0].accessTokenEncrypted).toBeUndefined();
  });

  it("sends a bad callback back with an error flag", async () => {
    const res = await googleCallback(
      new NextRequest(
        "http://localhost/api/connections/google/callback?code=x&state=garbage",
      ),
    );
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain(
      "connectionError=google",
    );
  });

  it("deletes a connection and reports when there is nothing to delete", async () => {
    const store = await getStore();
    await store.saveConnection({
      founderId,
      provider: "google",
      accountLabel: "sab@example.com",
      accessTokenEncrypted: "enc-access",
      refreshTokenEncrypted: "enc-refresh",
      tokenExpiresAt: null,
    });
    const deleted = await deleteConnection(
      new NextRequest(
        `http://localhost/api/connections/google?founderId=${founderId}`,
        { method: "DELETE" },
      ),
      { params: Promise.resolve({ provider: "google" }) },
    );
    const deletedData = (await deleted.json()) as { deleted: boolean };
    expect(deletedData.deleted).toBe(true);
    const again = await deleteConnection(
      new NextRequest(
        `http://localhost/api/connections/google?founderId=${founderId}`,
        { method: "DELETE" },
      ),
      { params: Promise.resolve({ provider: "google" }) },
    );
    const againData = (await again.json()) as { deleted: boolean };
    expect(againData.deleted).toBe(false);
  });
});

describe("interview route with a lead", () => {
  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  function postJson(url: string, body: unknown): NextRequest {
    return new NextRequest(`http://localhost${url}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("opens with the lead question and no model call", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const res = await interview(
      postJson("/api/interview", {
        transcript: "We lost a client last month.",
        turns: [],
        lead: {
          id: "lead-1",
          title: "Beta walked away",
          whatHappened: "Beta closed lost after 4 weeks.",
          angle: "The onboarding gap showed up again.",
          openingQuestion: "What did Beta say was missing?",
          sourceLabel: "HubSpot: Beta entered Closed Lost, Thu Nov 19",
        },
      }),
    );
    const data = (await res.json()) as { kind: string; text: string };
    expect(res.status).toBe(200);
    expect(data.kind).toBe("question");
    expect(data.text).toBe("What did Beta say was missing?");
  });

  it("still needs a key when there is no lead", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const res = await interview(
      postJson("/api/interview", {
        transcript: "We lost a client last month.",
        turns: [],
      }),
    );
    expect(res.status).toBe(503);
  });

  it("still needs a key for later questions in a lead session", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const res = await interview(
      postJson("/api/interview", {
        transcript: "We lost a client last month.",
        turns: [
          { role: "agent", body: "What did Beta say was missing?" },
          { role: "founder", body: "Our onboarding was slow." },
        ],
        lead: {
          id: "lead-1",
          title: "Beta walked away",
          whatHappened: "Beta closed lost after 4 weeks.",
          angle: "The onboarding gap showed up again.",
          openingQuestion: "What did Beta say was missing?",
          sourceLabel: "HubSpot: Beta entered Closed Lost, Thu Nov 19",
        },
      }),
    );
    expect(res.status).toBe(503);
  });

  it("still ends the interview at 3 questions in a lead session", async () => {
    // A fake key is enough: the cap check answers before any model call.
    process.env.ANTHROPIC_API_KEY = "test-key";
    const res = await interview(
      postJson("/api/interview", {
        transcript: "We lost a client last month.",
        turns: [
          { role: "agent", body: "What did Beta say was missing?" },
          { role: "founder", body: "Our onboarding was slow." },
          { role: "agent", body: "What changed after that?" },
          { role: "founder", body: "We gave week one an owner." },
          { role: "agent", body: "What would you tell another founder?" },
          { role: "founder", body: "Call the one you lost." },
        ],
        lead: {
          id: "lead-1",
          title: "Beta walked away",
          whatHappened: "Beta closed lost after 4 weeks.",
          angle: "The onboarding gap showed up again.",
          openingQuestion: "What did Beta say was missing?",
          sourceLabel: "HubSpot: Beta entered Closed Lost, Thu Nov 19",
        },
      }),
    );
    const data = (await res.json()) as { kind: string; text: string };
    expect(res.status).toBe(200);
    expect(data.kind).toBe("done");
  });
});
