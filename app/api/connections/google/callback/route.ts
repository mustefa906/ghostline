import { NextRequest, NextResponse } from "next/server";
import {
  encryptToken,
  exchangeGoogleCode,
  fetchGoogleAccountEmail,
  getTokenKey,
  parseOAuthState,
} from "@/lib/connections";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";

// Google OAuth callback. Exchanges the code for tokens, encrypts them,
// and stores the connection. Any failure sends the founder back to the
// dashboard with an error flag instead of a stack trace.
export async function GET(req: NextRequest) {
  const base = new URL("/", req.url);
  const fail = () =>
    NextResponse.redirect(new URL("/?connectionError=google", base));
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const parsed = state ? parseOAuthState(state) : null;
  if (!code || !parsed || parsed.provider !== "google") return fail();
  const clientId = process.env.GOOGLE_CLIENT_ID ?? "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? "";
  const key = getTokenKey();
  if (!clientId || !clientSecret || !key) return fail();
  const redirectUri = new URL(
    "/api/connections/google/callback",
    req.url,
  ).toString();
  const pair = await exchangeGoogleCode({
    code,
    clientId,
    clientSecret,
    redirectUri,
  });
  if (!pair || !pair.refreshToken) return fail();
  const email = await fetchGoogleAccountEmail(pair.accessToken);
  const store = await getStore();
  await store.saveConnection({
    founderId: parsed.founderId,
    provider: "google",
    accountLabel: email ?? "Google Calendar",
    accessTokenEncrypted: encryptToken(pair.accessToken, key),
    refreshTokenEncrypted: encryptToken(pair.refreshToken, key),
    tokenExpiresAt: pair.expiresIn
      ? new Date(Date.now() + pair.expiresIn * 1000).toISOString()
      : null,
  });
  return NextResponse.redirect(new URL("/?connected=google", base));
}
