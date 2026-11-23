// Story Harvest: source fetchers, lead parsing, ranking, and the harvest run.
// Everything here works on fixtures and injected fetchers in tests, so no
// test ever calls a live API.

import type { FetchFn } from "./connections";
import {
  HARVEST_SYSTEM_PROMPT,
  buildHarvestUserMessage,
} from "./prompts";
import type { LeadSourceType } from "./store";

export type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  attendeeCount: number;
};

export type DealChange = {
  id: string;
  name: string;
  stage: string;
  amount: number | null;
  closeDate: string | null;
  stageEnteredAt: string | null;
  lastModified: string;
};

export type SourceDigest = {
  calendarEvents: CalendarEvent[];
  dealChanges: DealChange[];
  noteText: string | null;
};

export type HarvestLeadDraft = {
  title: string;
  whatHappened: string;
  angle: string;
  openingQuestion: string;
  sourceRef: string;
  sourceLabel: string;
  sourceType: LeadSourceType;
  score: number;
};

export const MAX_LEADS_PER_WEEK = 3;
const WINDOW_DAYS = 7;

// The Monday of the week, as YYYY-MM-DD, in UTC so the week boundary is
// the same for every founder.
export function getWeekMonday(from: Date = new Date()): string {
  const d = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()),
  );
  const day = d.getUTCDay();
  const diff = (day + 6) % 7;
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const parts = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).formatToParts(d);
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${get("weekday")} ${get("month")} ${get("day")}`;
}

export function calendarSourceLabel(event: CalendarEvent): string {
  return `${event.title}, ${shortDate(event.start)}`;
}

export function hubSpotStageLabel(stage: string): string {
  if (stage === "closedwon") return "Closed Won";
  if (stage === "closedlost") return "Closed Lost";
  return stage;
}

export function hubSpotSourceLabel(deal: DealChange): string {
  const when = deal.stageEnteredAt ?? deal.lastModified;
  return `HubSpot: ${deal.name} entered ${hubSpotStageLabel(deal.stage)}, ${shortDate(when)}`;
}

export async function fetchCalendarEvents(
  accessToken: string,
  fetchFn: FetchFn = fetch,
  now: Date = new Date(),
): Promise<CalendarEvent[]> {
  const start = new Date(now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const params = new URLSearchParams({
    singleEvents: "true",
    orderBy: "startTime",
    timeMin: start.toISOString(),
    timeMax: now.toISOString(),
    maxResults: "50",
  });
  const res = await fetchFn(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) {
    const error = new Error(
      "Could not read your calendar. Reconnect it and try again.",
    ) as Error & { status?: number };
    error.status = res.status;
    throw error;
  }
  const body = (await res.json()) as {
    items?: {
      id?: unknown;
      summary?: unknown;
      start?: { dateTime?: unknown; date?: unknown };
      attendees?: unknown[];
    }[];
  };
  const items = Array.isArray(body.items) ? body.items : [];
  return items
    .filter((item) => typeof item.id === "string")
    .map((item) => ({
      id: item.id as string,
      title:
        typeof item.summary === "string" && item.summary.trim()
          ? item.summary
          : "(no title)",
      start:
        typeof item.start?.dateTime === "string"
          ? item.start.dateTime
          : typeof item.start?.date === "string"
            ? item.start.date
            : "",
      attendeeCount: Array.isArray(item.attendees)
        ? item.attendees.length
        : 0,
    }));
}

// HubSpot's search API returns current properties only, so the previous
// stage is never available. The honest stage-change signal is
// hs_date_entered_current_stage: a deal that entered its current stage
// inside the window changed stages this week.
export async function fetchHubSpotDealChanges(
  accessToken: string,
  fetchFn: FetchFn = fetch,
  now: Date = new Date(),
): Promise<DealChange[]> {
  const start = new Date(now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const res = await fetchFn(
    "https://api.hubapi.com/crm/v3/objects/deals/search",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filterGroups: [
          {
            filters: [
              {
                propertyName: "hs_date_entered_current_stage",
                operator: "GTE",
                value: String(start.getTime()),
              },
            ],
          },
        ],
        properties: [
          "dealname",
          "dealstage",
          "amount",
          "closedate",
          "hs_date_entered_current_stage",
          "hs_lastmodifieddate",
        ],
        sorts: [
          { propertyName: "hs_lastmodifieddate", direction: "DESCENDING" },
        ],
        limit: 20,
      }),
    },
  );
  if (!res.ok) {
    const error = new Error(
      "Could not read HubSpot. Reconnect it and try again.",
    ) as Error & { status?: number };
    error.status = res.status;
    throw error;
  }
  const body = (await res.json()) as {
    results?: {
      id?: unknown;
      properties?: Record<string, string | undefined>;
    }[];
  };
  const results = Array.isArray(body.results) ? body.results : [];
  return results
    .filter((r) => typeof r.id === "string")
    .map((r) => {
      const p = r.properties ?? {};
      const amount =
        typeof p.amount === "string" && p.amount.trim() !== ""
          ? Number(p.amount)
          : null;
      return {
        id: r.id as string,
        name:
          typeof p.dealname === "string" && p.dealname.trim()
            ? p.dealname
            : "(no name)",
        stage: typeof p.dealstage === "string" ? p.dealstage : "",
        amount: amount !== null && Number.isFinite(amount) ? amount : null,
        closeDate:
          typeof p.closedate === "string" ? p.closedate : null,
        stageEnteredAt:
          typeof p.hs_date_entered_current_stage === "string"
            ? p.hs_date_entered_current_stage
            : null,
        lastModified:
          typeof p.hs_lastmodifieddate === "string"
            ? p.hs_lastmodifieddate
            : "",
      };
    });
}

// True when a fetcher failed because the token was rejected. Only then
// does the harvest route try a refresh.
export function isAuthError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const status = (error as { status?: unknown }).status;
  return status === 401 || status === 403;
}

export function buildSourceDigestText(digest: SourceDigest): string {
  const lines: string[] = [];
  for (const event of digest.calendarEvents) {
    lines.push(
      `CALENDAR: ${event.id} | ${event.title} | ${event.start} | ${event.attendeeCount} attendees`,
    );
  }
  for (const deal of digest.dealChanges) {
    lines.push(
      `HUBSPOT: ${deal.id} | ${deal.name} | stage ${deal.stage} since ${deal.stageEnteredAt ?? deal.lastModified} | amount ${deal.amount ?? "unstated"} | close ${deal.closeDate ?? "unstated"}`,
    );
  }
  if (digest.noteText && digest.noteText.trim()) {
    lines.push(`NOTE: note | ${digest.noteText.trim()}`);
  }
  if (lines.length === 0) {
    return "No calendar events or deal changes in the last 7 days.";
  }
  return lines.join("\n");
}

// Strict parse, following the interview route pattern: find the JSON block,
// validate the shape, drop anything that fails. A bad reply means no leads.
export function parseHarvestReply(raw: string): HarvestLeadDraft[] | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1)) as unknown;
    if (typeof parsed !== "object" || parsed === null) return null;
    const leads = (parsed as { leads?: unknown }).leads;
    if (!Array.isArray(leads)) return null;
    const valid: HarvestLeadDraft[] = [];
    for (const item of leads) {
      if (typeof item !== "object" || item === null) continue;
      const l = item as Record<string, unknown>;
      if (
        typeof l.title !== "string" ||
        !l.title.trim() ||
        typeof l.whatHappened !== "string" ||
        !l.whatHappened.trim() ||
        typeof l.angle !== "string" ||
        !l.angle.trim() ||
        typeof l.openingQuestion !== "string" ||
        !l.openingQuestion.trim() ||
        typeof l.sourceRef !== "string" ||
        !l.sourceRef.trim() ||
        typeof l.sourceLabel !== "string" ||
        !l.sourceLabel.trim() ||
        (l.sourceType !== "calendar" &&
          l.sourceType !== "hubspot" &&
          l.sourceType !== "note") ||
        typeof l.score !== "number"
      ) {
        continue;
      }
      valid.push({
        title: l.title.trim(),
        whatHappened: l.whatHappened.trim(),
        angle: l.angle.trim(),
        openingQuestion: l.openingQuestion.trim(),
        sourceRef: l.sourceRef.trim(),
        sourceLabel: l.sourceLabel.trim(),
        sourceType: l.sourceType,
        score: Math.min(3, Math.max(1, Math.round(l.score))),
      });
    }
    return valid.slice(0, MAX_LEADS_PER_WEEK);
  } catch {
    return null;
  }
}

// Deterministic signal scores. The model still orders leads by judgment;
// these scores make the ranking rules testable and settle ties the same
// way every time.
export function scoreCalendarEvent(event: CalendarEvent): number {
  const title = event.title.toLowerCase();
  if (/(churn|cancel|lost|objection|complaint)/.test(title)) return 3;
  if (/(call|demo|interview|onboard|launch|close|sign)/.test(title)) return 2;
  return 1;
}

export function scoreDealChange(deal: DealChange): number {
  if (deal.stage === "closedlost") return 3;
  if (deal.stage === "closedwon") return 2;
  return 1;
}

export function scoreLead(
  lead: HarvestLeadDraft,
  sourceScore: number,
): number {
  const hasNumber = /\d/.test(`${lead.whatHappened} ${lead.angle}`);
  return sourceScore + (hasNumber ? 1 : 0);
}

export function sortLeads(
  leads: HarvestLeadDraft[],
  sourceScores: Map<string, number>,
): HarvestLeadDraft[] {
  return [...leads]
    .map((lead, index) => ({
      lead,
      index,
      rank: scoreLead(lead, sourceScores.get(lead.sourceRef) ?? 1),
    }))
    .sort((a, b) => b.rank - a.rank || b.lead.score - a.lead.score || a.index - b.index)
    .map(({ lead }) => lead);
}

export type ClaudeCall = (
  system: string,
  userMessage: string,
) => Promise<string>;

export async function runHarvest(args: {
  digest: SourceDigest;
  coveredAngles: string[];
  dismissed: string[];
  claudeCall: ClaudeCall;
}): Promise<{ leads: HarvestLeadDraft[]; ok: boolean }> {
  const digestText = buildSourceDigestText(args.digest);
  const userMessage = buildHarvestUserMessage({
    digest: digestText,
    coveredAngles: args.coveredAngles,
    dismissed: args.dismissed,
  });
  const raw = await args.claudeCall(HARVEST_SYSTEM_PROMPT, userMessage);
  const parsed = parseHarvestReply(raw);
  if (!parsed) return { leads: [], ok: false };
  const sourceScores = new Map<string, number>();
  for (const event of args.digest.calendarEvents) {
    sourceScores.set(event.id, scoreCalendarEvent(event));
  }
  for (const deal of args.digest.dealChanges) {
    sourceScores.set(deal.id, scoreDealChange(deal));
  }
  const knownRefs = new Set([
    ...args.digest.calendarEvents.map((e) => e.id),
    ...args.digest.dealChanges.map((d) => d.id),
    "note",
  ]);
  const grounded = parsed.filter((lead) => knownRefs.has(lead.sourceRef));
  return { leads: sortLeads(grounded, sourceScores), ok: true };
}
