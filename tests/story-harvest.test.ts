import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildGoogleAuthUrl,
  buildHubSpotAuthUrl,
  buildOAuthState,
  decryptToken,
  encryptToken,
  exchangeGoogleCode,
  fetchGoogleAccountEmail,
  fetchHubSpotAccountEmail,
  getTokenKey,
  parseOAuthState,
  refreshGoogleToken,
  revokeGoogleToken,
  type FetchFn,
} from "../lib/connections";
import { passesCopyRules } from "../lib/copy-rules";
import { JsonStore } from "../lib/json-store";
import { DEMO_HARVEST_SOURCES } from "../lib/demo-seed";
import {
  DRAFT_SYSTEM_PROMPT,
  HARVEST_SYSTEM_PROMPT,
  VERIFY_SYSTEM_PROMPT,
  buildDraftUserMessage,
  buildHarvestUserMessage,
  buildVerifyUserMessage,
} from "../lib/prompts";
import {
  buildSourceDigestText,
  calendarSourceLabel,
  fetchCalendarEvents,
  fetchHubSpotDealChanges,
  getWeekMonday,
  hubSpotSourceLabel,
  parseHarvestReply,
  runHarvest,
  scoreCalendarEvent,
  scoreDealChange,
  sortLeads,
  type DealChange,
  type HarvestLeadDraft,
} from "../lib/harvest";

// Story Harvest tests. The store tests use the JSON store with a temp file,
// the same pattern as tests/store.test.ts. The prompt, fetcher, ranking,
// and truth-rule tests below use fixtures and mocks only, never live calls.

describe("story harvest store", () => {
  let dir: string;
  let store: JsonStore;
  let founderId: string;

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), "ghostline-harvest-test-"));
    store = new JsonStore(join(dir, "ghostline.json"));
    const founder = await store.createFounder("Sab Ali", null);
    founderId = founder.id;
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("saves a connection and reads it back", async () => {
    const saved = await store.saveConnection({
      founderId,
      provider: "google",
      accountLabel: "sab@example.com",
      accessTokenEncrypted: "enc-access",
      refreshTokenEncrypted: "enc-refresh",
      tokenExpiresAt: new Date("2026-11-23T13:00:00Z").toISOString(),
    });
    expect(saved.provider).toBe("google");
    expect(saved.status).toBe("active");
    const list = await store.getConnections(founderId);
    expect(list).toHaveLength(1);
    expect(list[0].accountLabel).toBe("sab@example.com");
  });

  it("replaces the tokens when the same provider connects again", async () => {
    await store.saveConnection({
      founderId,
      provider: "hubspot",
      accountLabel: "hub-one",
      accessTokenEncrypted: "enc-one",
      refreshTokenEncrypted: "ref-one",
      tokenExpiresAt: null,
    });
    await store.saveConnection({
      founderId,
      provider: "hubspot",
      accountLabel: "hub-two",
      accessTokenEncrypted: "enc-two",
      refreshTokenEncrypted: "ref-two",
      tokenExpiresAt: null,
    });
    const list = await store.getConnections(founderId);
    expect(list).toHaveLength(1);
    expect(list[0].accessTokenEncrypted).toBe("enc-two");
    expect(list[0].accountLabel).toBe("hub-two");
  });

  it("marks a connection broken and back to active", async () => {
    const saved = await store.saveConnection({
      founderId,
      provider: "google",
      accountLabel: "sab@example.com",
      accessTokenEncrypted: "enc-access",
      refreshTokenEncrypted: "enc-refresh",
      tokenExpiresAt: null,
    });
    const broken = await store.updateConnection(saved.id, {
      status: "broken",
    });
    expect(broken?.status).toBe("broken");
    const fixed = await store.updateConnection(saved.id, {
      status: "active",
      accessTokenEncrypted: "enc-new",
    });
    expect(fixed?.status).toBe("active");
    expect(fixed?.accessTokenEncrypted).toBe("enc-new");
    expect(await store.updateConnection("missing", { status: "broken" })).toBeNull();
  });

  it("deletes a connection and only that source's leads", async () => {
    await store.saveConnection({
      founderId,
      provider: "google",
      accountLabel: "sab@example.com",
      accessTokenEncrypted: "enc-access",
      refreshTokenEncrypted: "enc-refresh",
      tokenExpiresAt: null,
    });
    await store.saveConnection({
      founderId,
      provider: "hubspot",
      accountLabel: "hub",
      accessTokenEncrypted: "enc-access",
      refreshTokenEncrypted: "enc-refresh",
      tokenExpiresAt: null,
    });
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
        weekOf: "2026-11-23",
      },
      {
        founderId,
        sourceType: "hubspot",
        sourceRef: "deal-1",
        sourceLabel: "HubSpot: Acme entered Closed Won, Nov 20",
        title: "Acme signed",
        whatHappened: "Acme moved to Closed Won.",
        angle: "Six weeks of follow-up paid off.",
        openingQuestion: "What kept the deal alive?",
        score: 3,
        weekOf: "2026-11-23",
      },
    ]);
    expect(await store.deleteConnection(founderId, "google")).toBe(true);
    expect(await store.getConnections(founderId)).toHaveLength(1);
    const remaining = await store.listLeads(founderId, "2026-11-23");
    expect(remaining).toHaveLength(1);
    expect(remaining[0].sourceType).toBe("hubspot");
    expect(await store.deleteConnection(founderId, "google")).toBe(false);
  });

  it("creates leads and lists only the requested week", async () => {
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
        weekOf: "2026-11-23",
      },
      {
        founderId,
        sourceType: "calendar",
        sourceRef: "event-9",
        sourceLabel: "Team sync, Mon Nov 16",
        title: "Last week",
        whatHappened: "A routine team sync.",
        angle: "Nothing new.",
        openingQuestion: "Anything worth sharing?",
        score: 1,
        weekOf: "2026-11-16",
      },
    ]);
    const week = await store.listLeads(founderId, "2026-11-23");
    expect(week).toHaveLength(1);
    expect(week[0].title).toBe("The call that ran long");
    expect(week[0].status).toBe("new");
    expect(week[0].dismissReason).toBeNull();
  });

  it("dismisses a lead with a reason and marks a lead used", async () => {
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
        weekOf: "2026-11-23",
      },
    ]);
    const dismissed = await store.updateLead(lead.id, {
      status: "dismissed",
      dismissReason: "too sensitive",
    });
    expect(dismissed?.status).toBe("dismissed");
    expect(dismissed?.dismissReason).toBe("too sensitive");
    const used = await store.updateLead(lead.id, { status: "used" });
    expect(used?.status).toBe("used");
    expect(await store.updateLead("missing", { status: "used" })).toBeNull();
  });
});

describe("connection tokens", () => {
  const KEY_ENV = "test-key-for-harvest";

  beforeEach(() => {
    process.env.TOKEN_ENCRYPTION_KEY = KEY_ENV;
  });

  afterEach(() => {
    delete process.env.TOKEN_ENCRYPTION_KEY;
  });

  it("encrypts and decrypts back to the same value", () => {
    const key = getTokenKey();
    expect(key).not.toBeNull();
    const encrypted = encryptToken("ya29.secret-token", key!);
    expect(encrypted).not.toContain("ya29.secret-token");
    expect(decryptToken(encrypted, key!)).toBe("ya29.secret-token");
  });

  it("encrypts the same token to a different value each time", () => {
    const key = getTokenKey()!;
    const first = encryptToken("same-token", key);
    const second = encryptToken("same-token", key);
    expect(first).not.toBe(second);
    expect(decryptToken(first, key)).toBe("same-token");
    expect(decryptToken(second, key)).toBe("same-token");
  });

  it("fails cleanly on a wrong key or a malformed value", () => {
    const key = getTokenKey()!;
    const encrypted = encryptToken("ya29.secret-token", key);
    process.env.TOKEN_ENCRYPTION_KEY = "a different key";
    const otherKey = getTokenKey()!;
    expect(() => decryptToken(encrypted, otherKey)).toThrow();
    expect(() => decryptToken("not-a-token", key)).toThrow();
  });

  it("returns null for the key when the environment value is missing", () => {
    delete process.env.TOKEN_ENCRYPTION_KEY;
    expect(getTokenKey()).toBeNull();
  });

  it("builds auth URLs with read-only scopes and the state", () => {
    const state = buildOAuthState("founder-1", "google");
    const googleUrl = buildGoogleAuthUrl({
      clientId: "google-id",
      redirectUri: "https://example.com/api/connections/google/callback",
      state,
    });
    expect(googleUrl).toContain("calendar.readonly");
    expect(googleUrl).toContain("access_type=offline");
    expect(parseOAuthState(state)).toEqual({
      founderId: "founder-1",
      provider: "google",
    });
    const hubspotUrl = buildHubSpotAuthUrl({
      clientId: "hubspot-id",
      redirectUri: "https://example.com/api/connections/hubspot/callback",
      state: buildOAuthState("founder-1", "hubspot"),
    });
    expect(hubspotUrl).toContain("crm.objects.deals.read");
    expect(parseOAuthState("garbage")).toBeNull();
    expect(
      parseOAuthState(buildOAuthState("founder-1", "slack")),
    ).toBeNull();
  });

  it("exchanges a code for a token pair with a mocked fetch", async () => {
    const fetchFn: FetchFn = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        access_token: "access-123",
        refresh_token: "refresh-123",
        expires_in: 3600,
      }),
      text: async () => "",
    });
    const pair = await exchangeGoogleCode({
      code: "auth-code",
      clientId: "google-id",
      clientSecret: "google-secret",
      redirectUri: "https://example.com/callback",
      fetchFn,
    });
    expect(pair?.accessToken).toBe("access-123");
    expect(pair?.refreshToken).toBe("refresh-123");
    expect(pair?.expiresIn).toBe(3600);
  });

  it("returns null when the token exchange fails", async () => {
    const fetchFn: FetchFn = async () => ({
      ok: false,
      status: 400,
      json: async () => ({ error: "invalid_grant" }),
      text: async () => "",
    });
    const pair = await exchangeGoogleCode({
      code: "bad-code",
      clientId: "google-id",
      clientSecret: "google-secret",
      redirectUri: "https://example.com/callback",
      fetchFn,
    });
    expect(pair).toBeNull();
  });

  it("refreshes an expired token and marks the failure when it cannot", async () => {
    const goodFetch: FetchFn = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        access_token: "access-new",
        refresh_token: "",
        expires_in: 3600,
      }),
      text: async () => "",
    });
    const refreshed = await refreshGoogleToken({
      refreshToken: "refresh-123",
      clientId: "google-id",
      clientSecret: "google-secret",
      fetchFn: goodFetch,
    });
    expect(refreshed?.accessToken).toBe("access-new");
    const badFetch: FetchFn = async () => ({
      ok: false,
      status: 400,
      json: async () => ({}),
      text: async () => "",
    });
    expect(
      await refreshGoogleToken({
        refreshToken: "refresh-123",
        clientId: "google-id",
        clientSecret: "google-secret",
        fetchFn: badFetch,
      }),
    ).toBeNull();
  });

  it("still resolves when the revoke call throws", async () => {
    const throwingFetch: FetchFn = async () => {
      throw new Error("network down");
    };
    await expect(
      revokeGoogleToken("token-123", throwingFetch),
    ).resolves.toBeUndefined();
  });

  it("reads the account email for the settings label", async () => {
    const googleFetch: FetchFn = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ email: "sab@example.com" }),
      text: async () => "",
    });
    expect(await fetchGoogleAccountEmail("token-123", googleFetch)).toBe(
      "sab@example.com",
    );
    const hubspotFetch: FetchFn = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ user: "sab@example.com" }),
      text: async () => "",
    });
    expect(await fetchHubSpotAccountEmail("token-123", hubspotFetch)).toBe(
      "sab@example.com",
    );
    const failingFetch: FetchFn = async () => ({
      ok: false,
      status: 401,
      json: async () => ({}),
      text: async () => "",
    });
    expect(await fetchGoogleAccountEmail("token-123", failingFetch)).toBeNull();
    expect(await fetchHubSpotAccountEmail("token-123", failingFetch)).toBeNull();
  });
});

describe("harvest prompts", () => {
  it("passes the house copy rules itself", () => {
    expect(passesCopyRules(HARVEST_SYSTEM_PROMPT)).toBe(true);
  });

  it("carries the same discipline as the draft prompt", () => {
    expect(HARVEST_SYSTEM_PROMPT).toContain("never invent a number");
    expect(HARVEST_SYSTEM_PROMPT).toContain(
      "must come from the source digest",
    );
    expect(HARVEST_SYSTEM_PROMPT).toContain(
      "return no leads",
    );
    expect(HARVEST_SYSTEM_PROMPT).toContain("at most 3 leads");
    expect(HARVEST_SYSTEM_PROMPT).toContain("tension first");
  });

  it("answers with JSON only, one lead per source record", () => {
    expect(HARVEST_SYSTEM_PROMPT).toContain(
      "You answer with JSON only, no other text",
    );
    expect(HARVEST_SYSTEM_PROMPT).toContain('"leads"');
    expect(HARVEST_SYSTEM_PROMPT).toContain('"openingQuestion"');
    expect(HARVEST_SYSTEM_PROMPT).toContain('"sourceRef"');
    expect(HARVEST_SYSTEM_PROMPT).toContain('"sourceLabel"');
  });

  it("builds the harvest message from the digest and the skip lists", () => {
    const message = buildHarvestUserMessage({
      digest: "CALENDAR: event-1 | Sales call with Acme | 2026-11-24",
      coveredAngles: ["The first week is the whole relationship."],
      dismissed: ["The pricing thread"],
    });
    expect(message).toContain("Sales call with Acme");
    expect(message).toContain(
      "The first week is the whole relationship.",
    );
    expect(message).toContain("The pricing thread");
    expect(message).toContain("Pick up to 3 leads as JSON.");
  });

  it("says plainly when there is nothing to skip", () => {
    const message = buildHarvestUserMessage({
      digest: "CALENDAR: event-1 | Sales call | 2026-11-24",
      coveredAngles: [],
      dismissed: [],
    });
    expect(message).toContain("None.");
  });
});

describe("harvest fetchers and ranking", () => {
  it("finds the Monday of the week", () => {
    expect(getWeekMonday(new Date("2026-11-25T12:00:00Z"))).toBe(
      "2026-11-23",
    );
    expect(getWeekMonday(new Date("2026-11-29T12:00:00Z"))).toBe(
      "2026-11-23",
    );
    expect(getWeekMonday(new Date("2026-11-23T00:00:00Z"))).toBe(
      "2026-11-23",
    );
  });

  it("maps calendar events to the minimal fields", async () => {
    const fetchFn: FetchFn = async (input) => {
      expect(input).toContain("timeMin=");
      expect(input).toContain("maxResults=50");
      return {
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            {
              id: "event-1",
              summary: "Sales call with Acme",
              start: { dateTime: "2026-11-24T15:00:00Z" },
              attendees: [{ email: "a@x.com" }, { email: "b@x.com" }],
            },
            { id: "event-2", summary: "Team sync", start: {} },
          ],
        }),
        text: async () => "",
      };
    };
    const events = await fetchCalendarEvents(
      "token-123",
      fetchFn,
      new Date("2026-11-25T00:00:00Z"),
    );
    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({
      id: "event-1",
      title: "Sales call with Acme",
      start: "2026-11-24T15:00:00Z",
      attendeeCount: 2,
    });
    expect(events[1].title).toBe("Team sync");
  });

  it("throws a plain message when the calendar cannot be read", async () => {
    const fetchFn: FetchFn = async () => ({
      ok: false,
      status: 401,
      json: async () => ({}),
      text: async () => "",
    });
    await expect(fetchCalendarEvents("bad-token", fetchFn)).rejects.toThrow(
      "Could not read your calendar",
    );
  });

  it("maps HubSpot deals that entered a stage this week", async () => {
    let seenBody = "";
    const fetchFn: FetchFn = async (_input, init) => {
      seenBody = String(init?.body ?? "");
      return {
        ok: true,
        status: 200,
        json: async () => ({
          results: [
            {
              id: "deal-1",
              properties: {
                dealname: "Acme",
                dealstage: "closedwon",
                amount: "50000",
                closedate: "2026-11-20",
                hs_date_entered_current_stage: "2026-11-20T10:00:00Z",
                hs_lastmodifieddate: "2026-11-20T10:05:00Z",
              },
            },
            {
              id: "deal-2",
              properties: {
                dealname: "Beta",
                dealstage: "closedlost",
                amount: "",
                hs_date_entered_current_stage: "2026-11-19T09:00:00Z",
                hs_lastmodifieddate: "2026-11-19T09:00:00Z",
              },
            },
          ],
        }),
        text: async () => "",
      };
    };
    const deals = await fetchHubSpotDealChanges(
      "token-123",
      fetchFn,
      new Date("2026-11-25T00:00:00Z"),
    );
    const body = JSON.parse(seenBody) as {
      filterGroups: { filters: { propertyName: string }[] }[];
    };
    expect(
      body.filterGroups[0].filters[0].propertyName,
    ).toBe("hs_date_entered_current_stage");
    expect(deals).toHaveLength(2);
    expect(deals[0].amount).toBe(50000);
    expect(deals[1].amount).toBeNull();
    expect(deals[1].stage).toBe("closedlost");
  });

  it("throws a plain message when HubSpot cannot be read", async () => {
    const fetchFn: FetchFn = async () => ({
      ok: false,
      status: 401,
      json: async () => ({}),
      text: async () => "",
    });
    await expect(fetchHubSpotDealChanges("bad-token", fetchFn)).rejects.toThrow(
      "Could not read HubSpot",
    );
  });

  it("builds a compact digest and says plainly when it is empty", () => {
    const text = buildSourceDigestText({
      calendarEvents: [
        {
          id: "event-1",
          title: "Sales call with Acme",
          start: "2026-11-24T15:00:00Z",
          attendeeCount: 2,
        },
      ],
      dealChanges: [
        {
          id: "deal-1",
          name: "Acme",
          stage: "closedwon",
          amount: 50000,
          closeDate: "2026-11-20",
          stageEnteredAt: "2026-11-20T10:00:00Z",
          lastModified: "2026-11-20T10:05:00Z",
        },
      ],
      noteText: null,
    });
    expect(text).toContain("CALENDAR: event-1 | Sales call with Acme");
    expect(text).toContain("HUBSPOT: deal-1 | Acme | stage closedwon");
    expect(
      buildSourceDigestText({
        calendarEvents: [],
        dealChanges: [],
        noteText: null,
      }),
    ).toContain("No calendar events or deal changes");
  });

  it("labels sources the way the founder recognises them", () => {
    expect(
      calendarSourceLabel({
        id: "event-1",
        title: "Sales call with Acme",
        start: "2026-11-24T15:00:00Z",
        attendeeCount: 2,
      }),
    ).toBe("Sales call with Acme, Tue Nov 24");
    expect(
      hubSpotSourceLabel({
        id: "deal-1",
        name: "Acme",
        stage: "closedwon",
        amount: 50000,
        closeDate: "2026-11-20",
        stageEnteredAt: "2026-11-20T10:00:00Z",
        lastModified: "2026-11-20T10:05:00Z",
      } as DealChange),
    ).toBe("HubSpot: Acme entered Closed Won, Fri Nov 20");
  });

  it("parses a clean harvest reply and caps it at 3 leads", () => {
    const raw = JSON.stringify({
      leads: [1, 2, 3, 4, 5].map((n) => ({
        title: `Lead ${n}`,
        whatHappened: "Something happened.",
        angle: "The lesson.",
        openingQuestion: "What happened?",
        sourceRef: `event-${n}`,
        sourceLabel: `Event ${n}`,
        sourceType: "calendar",
        score: 2,
      })),
    });
    const leads = parseHarvestReply(raw);
    expect(leads).toHaveLength(3);
    expect(leads?.[0].title).toBe("Lead 1");
  });

  it("drops a lead with no source reference and rejects a bad reply", () => {
    const raw = JSON.stringify({
      leads: [
        {
          title: "Good lead",
          whatHappened: "Something happened.",
          angle: "The lesson.",
          openingQuestion: "What happened?",
          sourceRef: "event-1",
          sourceLabel: "Event 1",
          sourceType: "calendar",
          score: 2,
        },
        {
          title: "Invented lead",
          whatHappened: "Something happened.",
          angle: "The lesson.",
          openingQuestion: "What happened?",
          sourceRef: "  ",
          sourceLabel: "Nowhere",
          sourceType: "calendar",
          score: 3,
        },
      ],
    });
    expect(parseHarvestReply(raw)).toHaveLength(1);
    expect(parseHarvestReply("not json at all")).toBeNull();
    expect(parseHarvestReply('{"nope": true}')).toBeNull();
  });

  it("ranks a closed-lost deal above a routine meeting", () => {
    expect(
      scoreDealChange({
        id: "deal-1",
        name: "Beta",
        stage: "closedlost",
        amount: null,
        closeDate: null,
        stageEnteredAt: null,
        lastModified: "",
      }),
    ).toBe(3);
    expect(
      scoreDealChange({
        id: "deal-2",
        name: "Acme",
        stage: "closedwon",
        amount: 50000,
        closeDate: null,
        stageEnteredAt: null,
        lastModified: "",
      }),
    ).toBe(2);
    expect(
      scoreCalendarEvent({
        id: "event-1",
        title: "Churn call with Beta",
        start: "",
        attendeeCount: 1,
      }),
    ).toBe(3);
    expect(
      scoreCalendarEvent({
        id: "event-2",
        title: "Team sync",
        start: "",
        attendeeCount: 4,
      }),
    ).toBe(1);
  });

  it("ranks a lead with a real number above one with none", () => {
    const withNumber: HarvestLeadDraft = {
      title: "Acme signed",
      whatHappened: "Acme signed a $50,000 deal after 6 weeks.",
      angle: "Follow-up paid off.",
      openingQuestion: "What kept it alive?",
      sourceRef: "deal-1",
      sourceLabel: "HubSpot: Acme",
      sourceType: "hubspot",
      score: 2,
    };
    const withoutNumber: HarvestLeadDraft = {
      title: "A good call",
      whatHappened: "A sales call went well.",
      angle: "The client opened up.",
      openingQuestion: "What did they say?",
      sourceRef: "deal-2",
      sourceLabel: "HubSpot: Beta",
      sourceType: "hubspot",
      score: 2,
    };
    const sorted = sortLeads(
      [withoutNumber, withNumber],
      new Map([
        ["deal-1", 2],
        ["deal-2", 2],
      ]),
    );
    expect(sorted[0].title).toBe("Acme signed");
  });

  it("never puts a number in the digest that the source did not state", () => {
    const text = buildSourceDigestText({
      calendarEvents: [
        {
          id: "event-1",
          title: "Team sync",
          start: "2026-11-24T15:00:00Z",
          attendeeCount: 3,
        },
      ],
      dealChanges: [
        {
          id: "deal-1",
          name: "Beta",
          stage: "negotiation",
          amount: null,
          closeDate: null,
          stageEnteredAt: "2026-11-19T09:00:00Z",
          lastModified: "2026-11-19T09:00:00Z",
        },
      ],
      noteText: null,
    });
    expect(text).toContain("amount unstated");
    expect(text).toContain("close unstated");
    expect(text).not.toContain("$");
  });

  it("runs a harvest on fixtures and sorts the leads", async () => {
    const result = await runHarvest({
      digest: {
        calendarEvents: [
          {
            id: "event-1",
            title: "Sales call with Acme",
            start: "2026-11-24T15:00:00Z",
            attendeeCount: 2,
          },
        ],
        dealChanges: [
          {
            id: "deal-1",
            name: "Beta",
            stage: "closedlost",
            amount: null,
            closeDate: null,
            stageEnteredAt: "2026-11-19T09:00:00Z",
            lastModified: "2026-11-19T09:00:00Z",
          },
        ],
        noteText: null,
      },
      coveredAngles: [],
      dismissed: [],
      claudeCall: async () =>
        JSON.stringify({
          leads: [
            {
              title: "The call that ran long",
              whatHappened: "A sales call ran 20 minutes over.",
              angle: "The objection that almost ended it.",
              openingQuestion: "What was the objection?",
              sourceRef: "event-1",
              sourceLabel: "Sales call with Acme, Tue Nov 24",
              sourceType: "calendar",
              score: 2,
            },
            {
              title: "Beta walked away",
              whatHappened: "Beta closed lost after 4 weeks.",
              angle: "The onboarding gap showed up again.",
              openingQuestion: "What did Beta say was missing?",
              sourceRef: "deal-1",
              sourceLabel: "HubSpot: Beta entered Closed Lost, Thu Nov 19",
              sourceType: "hubspot",
              score: 3,
            },
          ],
        }),
    });
    expect(result.ok).toBe(true);
    expect(result.leads).toHaveLength(2);
    expect(result.leads[0].title).toBe("Beta walked away");
  });

  it("returns no leads when the model reply cannot be read", async () => {
    const result = await runHarvest({
      digest: { calendarEvents: [], dealChanges: [], noteText: null },
      coveredAngles: [],
      dismissed: [],
      claudeCall: async () => "this is not JSON",
    });
    expect(result.ok).toBe(false);
    expect(result.leads).toEqual([]);
  });
});

describe("truth rule with a lead session", () => {
  // The lead says Acme signed a $50,000 deal. The founder never says any
  // of that in the transcript or the answers. Nothing from the lead may
  // reach the draft or the verification pass.
  const transcript = "We lost a client last month, and it hurt.";
  const answers = [
    {
      question: "What went wrong in that first week?",
      answer: "Nobody owned it.",
    },
  ];

  it("keeps source-record facts out of the draft input", () => {
    const message = buildDraftUserMessage({
      transcript,
      answers,
      fingerprint: ["I write short lines."],
    });
    expect(message).toContain("We lost a client last month");
    expect(message).toContain("Nobody owned it.");
    expect(message).not.toContain("Acme");
    expect(message).not.toContain("50,000");
    expect(message).not.toContain("50000");
    expect(message).not.toContain("HubSpot");
    expect(message).not.toContain("calendar");
  });

  it("keeps source-record facts out of the verification input", () => {
    const message = buildVerifyUserMessage({
      transcript,
      answers,
      draft: "We lost a client last month.\n\nNobody owned the first week.",
    });
    expect(message).toContain("We lost a client last month.");
    expect(message).not.toContain("Acme");
    expect(message).not.toContain("50,000");
    expect(message).not.toContain("HubSpot");
    expect(message).not.toContain("calendar");
  });

  it("leaves the draft and verify prompts unchanged by the harvest", () => {
    expect(DRAFT_SYSTEM_PROMPT).toContain("TRUTH RULE");
    expect(DRAFT_SYSTEM_PROMPT).not.toContain("calendar");
    expect(DRAFT_SYSTEM_PROMPT).not.toContain("HubSpot");
    expect(DRAFT_SYSTEM_PROMPT).not.toContain("source record");
    expect(VERIFY_SYSTEM_PROMPT).toContain("They never count as evidence");
    expect(VERIFY_SYSTEM_PROMPT).not.toContain("calendar");
    expect(VERIFY_SYSTEM_PROMPT).not.toContain("HubSpot");
    expect(VERIFY_SYSTEM_PROMPT).not.toContain("source record");
  });

  it("lets the founder confirm a source fact first, then it counts", () => {
    const confirmed = buildDraftUserMessage({
      transcript,
      answers: [
        ...answers,
        {
          question: "Your CRM shows the deal at $50,000. Is that right?",
          answer: "Yes, $50,000, and it took six weeks.",
        },
      ],
      fingerprint: ["I write short lines."],
    });
    expect(confirmed).toContain("$50,000");
    expect(confirmed).toContain("six weeks");
  });
});

describe("demo harvest fixtures", () => {
  it("carries three calendar events and two deal changes", () => {
    expect(DEMO_HARVEST_SOURCES.calendarEvents).toHaveLength(3);
    expect(DEMO_HARVEST_SOURCES.dealChanges).toHaveLength(2);
    const stages = DEMO_HARVEST_SOURCES.dealChanges.map((d) => d.stage);
    expect(stages).toContain("closedwon");
    expect(stages).toContain("negotiation");
  });

  it("reads as a digest the harvest can use", () => {
    const text = buildSourceDigestText(DEMO_HARVEST_SOURCES);
    expect(text).toContain("demo-event-1");
    expect(text).toContain("demo-deal-1");
    expect(text).toContain("Northwind");
    expect(text).toContain("Harbor Health");
  });

  it("labels the demo sources the way a founder reads them", () => {
    expect(
      calendarSourceLabel(DEMO_HARVEST_SOURCES.calendarEvents[0]),
    ).toBe("Sales call with Northwind, Tue Nov 24");
    expect(
      hubSpotSourceLabel(DEMO_HARVEST_SOURCES.dealChanges[0]),
    ).toBe("HubSpot: Northwind entered Closed Won, Fri Nov 20");
  });
});
