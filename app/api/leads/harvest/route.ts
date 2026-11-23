import { NextRequest, NextResponse } from "next/server";
import {
  CLAUDE_MODEL,
  getAnthropicClient,
  isMissingKey,
} from "@/lib/anthropic";
import {
  decryptToken,
  encryptToken,
  getTokenKey,
  refreshGoogleToken,
  refreshHubSpotToken,
} from "@/lib/connections";
import { DEMO_HARVEST_SOURCES } from "@/lib/demo-seed";
import {
  fetchCalendarEvents,
  fetchHubSpotDealChanges,
  getWeekMonday,
  isAuthError,
  runHarvest,
  type CalendarEvent,
  type DealChange,
  type SourceDigest,
} from "@/lib/harvest";
import { getStore, type Connection, type Store } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 60;

type HarvestBody = {
  founderId?: string;
  noteText?: string;
  demo?: boolean;
  refresh?: boolean;
};

// Reads one connected source. A rejected token gets one refresh and one
// retry. A failed refresh marks the connection broken. Any other failure
// skips the source and leaves the connection alone.
async function readConnectionSource(
  connection: Connection,
  key: Buffer,
  store: Store,
): Promise<{ events: CalendarEvent[]; deals: DealChange[] }> {
  const empty = { events: [] as CalendarEvent[], deals: [] as DealChange[] };
  let accessToken: string;
  try {
    accessToken = decryptToken(connection.accessTokenEncrypted, key);
  } catch {
    await store.updateConnection(connection.id, { status: "broken" });
    return empty;
  }
  const fetchOnce = async (token: string) => {
    if (connection.provider === "google") {
      return {
        events: await fetchCalendarEvents(token),
        deals: [] as DealChange[],
      };
    }
    return {
      events: [] as CalendarEvent[],
      deals: await fetchHubSpotDealChanges(token),
    };
  };
  try {
    return await fetchOnce(accessToken);
  } catch (error) {
    if (!isAuthError(error)) {
      console.warn(
        `Ghostline: skipping the ${connection.provider} source after a fetch failure.`,
      );
      return empty;
    }
  }
  let refreshToken = "";
  try {
    refreshToken = decryptToken(connection.refreshTokenEncrypted, key);
  } catch {
    refreshToken = "";
  }
  if (!refreshToken) {
    await store.updateConnection(connection.id, { status: "broken" });
    return empty;
  }
  const clientId =
    connection.provider === "google"
      ? (process.env.GOOGLE_CLIENT_ID ?? "")
      : (process.env.HUBSPOT_CLIENT_ID ?? "");
  const clientSecret =
    connection.provider === "google"
      ? (process.env.GOOGLE_CLIENT_SECRET ?? "")
      : (process.env.HUBSPOT_CLIENT_SECRET ?? "");
  const pair =
    connection.provider === "google"
      ? await refreshGoogleToken({ refreshToken, clientId, clientSecret })
      : await refreshHubSpotToken({ refreshToken, clientId, clientSecret });
  if (!pair) {
    await store.updateConnection(connection.id, { status: "broken" });
    return empty;
  }
  await store.updateConnection(connection.id, {
    status: "active",
    accessTokenEncrypted: encryptToken(pair.accessToken, key),
    refreshTokenEncrypted: pair.refreshToken
      ? encryptToken(pair.refreshToken, key)
      : undefined,
    tokenExpiresAt: pair.expiresIn
      ? new Date(Date.now() + pair.expiresIn * 1000).toISOString()
      : null,
  });
  try {
    return await fetchOnce(pair.accessToken);
  } catch {
    console.warn(
      `Ghostline: skipping the ${connection.provider} source after a refresh retry.`,
    );
    return empty;
  }
}

export async function POST(req: NextRequest) {
  let body: HarvestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "That request was not valid JSON." },
      { status: 400 },
    );
  }
  const founderId = (body.founderId ?? "").trim();
  if (!founderId) {
    return NextResponse.json(
      { error: "Add a founder first, then run the harvest." },
      { status: 400 },
    );
  }
  const noteText =
    typeof body.noteText === "string" ? body.noteText.trim() : "";
  const demo = body.demo === true;
  const refresh = body.refresh === true;

  const store = await getStore();
  const weekOf = getWeekMonday();
  const existing = await store.listLeads(founderId, weekOf);
  const fresh = existing.filter((l) => l.status === "new");
  if (fresh.length > 0 && !refresh) {
    return NextResponse.json({ leads: fresh });
  }
  if (refresh) {
    for (const lead of fresh) {
      await store.updateLead(lead.id, { status: "expired" });
    }
  }

  let digest: SourceDigest;
  let connected = false;
  if (demo) {
    digest = { ...DEMO_HARVEST_SOURCES, noteText: noteText || null };
  } else {
    const connections = await store.getConnections(founderId);
    connected = connections.length > 0;
    const key = getTokenKey();
    if (connections.length > 0 && !key) {
      return NextResponse.json(
        {
          error:
            "The token key is missing. Set TOKEN_ENCRYPTION_KEY in your environment and try again.",
        },
        { status: 503 },
      );
    }
    const events: CalendarEvent[] = [];
    const deals: DealChange[] = [];
    if (key) {
      for (const connection of connections) {
        if (connection.status !== "active") continue;
        const part = await readConnectionSource(connection, key, store);
        events.push(...part.events);
        deals.push(...part.deals);
      }
    }
    digest = {
      calendarEvents: events,
      dealChanges: deals,
      noteText: noteText || null,
    };
  }

  const hasInput =
    digest.calendarEvents.length > 0 ||
    digest.dealChanges.length > 0 ||
    (digest.noteText ?? "").trim().length > 0;
  if (!hasInput) {
    return NextResponse.json({ leads: [], connected });
  }

  const anthropic = getAnthropicClient();
  if (isMissingKey(anthropic)) {
    return NextResponse.json(
      {
        error:
          "The harvest needs an Anthropic key. Set ANTHROPIC_API_KEY in your environment and try again.",
      },
      { status: 503 },
    );
  }
  const client = anthropic.client;

  const drafts = await store.listDrafts(founderId);
  const coveredAngles = drafts
    .slice(-10)
    .map((d) => d.body.split("\n").find((line) => line.trim()) ?? "")
    .map((line) => line.trim().slice(0, 120))
    .filter((line) => line.length > 0);
  const dismissed = existing
    .filter((l) => l.status === "dismissed")
    .map((l) => l.title);

  try {
    const result = await runHarvest({
      digest,
      coveredAngles,
      dismissed,
      claudeCall: async (system, userMessage) => {
        const message = await client.messages.create({
          model: CLAUDE_MODEL,
          max_tokens: 1500,
          system,
          messages: [{ role: "user", content: userMessage }],
        });
        return message.content
          .filter((b) => b.type === "text")
          .map((b) => b.text)
          .join("")
          .trim();
      },
    });
    if (!result.ok) {
      return NextResponse.json(
        {
          error: "The harvest did not return clean leads. Try the refresh.",
        },
        { status: 502 },
      );
    }
    const created = await store.createLeads(
      result.leads.map((l) => ({ founderId, ...l, weekOf })),
    );
    return NextResponse.json({ leads: created });
  } catch {
    return NextResponse.json(
      { error: "The harvest hit a snag. Try the refresh." },
      { status: 502 },
    );
  }
}
