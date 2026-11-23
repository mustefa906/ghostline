import { NextRequest, NextResponse } from "next/server";
import { buildHubSpotAuthUrl, buildOAuthState } from "@/lib/connections";

export const runtime = "nodejs";

// Starts the HubSpot OAuth flow. Returns the authorization URL; the
// browser goes there next.
export async function POST(req: NextRequest) {
  let body: { founderId?: string };
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
      { error: "Add a founder first, then connect a source." },
      { status: 400 },
    );
  }
  const clientId = process.env.HUBSPOT_CLIENT_ID ?? "";
  if (!clientId) {
    return NextResponse.json(
      {
        error:
          "The HubSpot client id is missing. Set HUBSPOT_CLIENT_ID in your environment and try again.",
      },
      { status: 503 },
    );
  }
  const redirectUri = new URL(
    "/api/connections/hubspot/callback",
    req.url,
  ).toString();
  const url = buildHubSpotAuthUrl({
    clientId,
    redirectUri,
    state: buildOAuthState(founderId, "hubspot"),
  });
  return NextResponse.json({ url });
}
