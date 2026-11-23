// OAuth token handling for Story Harvest connections.
// Tokens are encrypted with AES-256-GCM before they reach the store, and
// decrypted only here, at the moment of use. The key comes from the
// TOKEN_ENCRYPTION_KEY environment variable. Client ids and secrets come
// from environment variables only, never from code.

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number | null;
};

export type FetchFn = (
  input: string,
  init?: RequestInit,
) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
}>;

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const HUBSPOT_TOKEN_URL = "https://api.hubapi.com/oauth/v1/token";
const HUBSPOT_AUTH_URL = "https://app.hubspot.com/oauth/authorize";

export const GOOGLE_CALENDAR_SCOPE =
  "https://www.googleapis.com/auth/calendar.readonly";
export const HUBSPOT_SCOPES =
  "crm.objects.deals.read crm.objects.contacts.read";

// The key is hashed to 32 bytes, so any passphrase-shaped value works.
export function getTokenKey(): Buffer | null {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) return null;
  return createHash("sha256").update(raw).digest();
}

export function encryptToken(plaintext: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf-8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    iv.toString("hex"),
    encrypted.toString("hex"),
    tag.toString("hex"),
  ].join(":");
}

export function decryptToken(ciphertext: string, key: Buffer): string {
  const parts = ciphertext.split(":");
  if (parts.length !== 3) {
    throw new Error("That stored token is in an unknown format.");
  }
  const [ivHex, encryptedHex, tagHex] = parts;
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivHex, "hex"),
  );
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, "hex")),
    decipher.final(),
  ]);
  return decrypted.toString("utf-8");
}

export function buildOAuthState(founderId: string, provider: string): string {
  return Buffer.from(
    JSON.stringify({ founderId, provider }),
    "utf-8",
  ).toString("base64url");
}

export function parseOAuthState(
  state: string,
): { founderId: string; provider: string } | null {
  try {
    const parsed = JSON.parse(
      Buffer.from(state, "base64url").toString("utf-8"),
    ) as { founderId?: unknown; provider?: unknown };
    if (
      typeof parsed.founderId === "string" &&
      parsed.founderId.length > 0 &&
      (parsed.provider === "google" || parsed.provider === "hubspot")
    ) {
      return {
        founderId: parsed.founderId,
        provider: parsed.provider,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function buildGoogleAuthUrl(args: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const params = new URLSearchParams({
    client_id: args.clientId,
    redirect_uri: args.redirectUri,
    response_type: "code",
    scope: GOOGLE_CALENDAR_SCOPE,
    access_type: "offline",
    prompt: "consent",
    state: args.state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export function buildHubSpotAuthUrl(args: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const params = new URLSearchParams({
    client_id: args.clientId,
    redirect_uri: args.redirectUri,
    scope: HUBSPOT_SCOPES,
    state: args.state,
  });
  return `${HUBSPOT_AUTH_URL}?${params.toString()}`;
}

type TokenResponse = {
  access_token?: unknown;
  refresh_token?: unknown;
  expires_in?: unknown;
};

function readTokenPair(body: unknown): TokenPair | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as TokenResponse;
  if (typeof b.access_token !== "string") return null;
  return {
    accessToken: b.access_token,
    refreshToken:
      typeof b.refresh_token === "string" ? b.refresh_token : "",
    expiresIn:
      typeof b.expires_in === "number" ? b.expires_in : null,
  };
}

async function postForm(
  url: string,
  params: Record<string, string>,
  fetchFn: FetchFn,
): Promise<TokenPair | null> {
  const res = await fetchFn(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });
  if (!res.ok) return null;
  return readTokenPair(await res.json());
}

export async function exchangeGoogleCode(args: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  fetchFn?: FetchFn;
}): Promise<TokenPair | null> {
  return postForm(
    GOOGLE_TOKEN_URL,
    {
      code: args.code,
      client_id: args.clientId,
      client_secret: args.clientSecret,
      redirect_uri: args.redirectUri,
      grant_type: "authorization_code",
    },
    args.fetchFn ?? fetch,
  );
}

export async function exchangeHubSpotCode(args: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  fetchFn?: FetchFn;
}): Promise<TokenPair | null> {
  return postForm(
    HUBSPOT_TOKEN_URL,
    {
      code: args.code,
      client_id: args.clientId,
      client_secret: args.clientSecret,
      redirect_uri: args.redirectUri,
      grant_type: "authorization_code",
    },
    args.fetchFn ?? fetch,
  );
}

export async function refreshGoogleToken(args: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
  fetchFn?: FetchFn;
}): Promise<TokenPair | null> {
  return postForm(
    GOOGLE_TOKEN_URL,
    {
      refresh_token: args.refreshToken,
      client_id: args.clientId,
      client_secret: args.clientSecret,
      grant_type: "refresh_token",
    },
    args.fetchFn ?? fetch,
  );
}

export async function refreshHubSpotToken(args: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
  fetchFn?: FetchFn;
}): Promise<TokenPair | null> {
  return postForm(
    HUBSPOT_TOKEN_URL,
    {
      refresh_token: args.refreshToken,
      client_id: args.clientId,
      client_secret: args.clientSecret,
      grant_type: "refresh_token",
    },
    args.fetchFn ?? fetch,
  );
}

// The account email shown in settings. Best effort: a failed lookup
// returns null and the caller falls back to a plain provider label.
export async function fetchGoogleAccountEmail(
  accessToken: string,
  fetchFn: FetchFn = fetch,
): Promise<string | null> {
  try {
    const res = await fetchFn(
      "https://openidconnect.googleapis.com/v1/userinfo",
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { email?: unknown };
    return typeof body.email === "string" ? body.email : null;
  } catch {
    return null;
  }
}

export async function fetchHubSpotAccountEmail(
  accessToken: string,
  fetchFn: FetchFn = fetch,
): Promise<string | null> {
  try {
    const res = await fetchFn(
      `https://api.hubapi.com/oauth/v1/access-tokens/${encodeURIComponent(accessToken)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { user?: unknown };
    return typeof body.user === "string" ? body.user : null;
  } catch {
    return null;
  }
}

// Revoke calls are best effort. A failed revoke never blocks a disconnect.
export async function revokeGoogleToken(
  token: string,
  fetchFn: FetchFn = fetch,
): Promise<void> {
  try {
    await fetchFn(GOOGLE_REVOKE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }).toString(),
    });
  } catch {
    // The disconnect still goes ahead.
  }
}

export async function revokeHubSpotToken(
  refreshToken: string,
  fetchFn: FetchFn = fetch,
): Promise<void> {
  try {
    await fetchFn(
      `https://api.hubapi.com/oauth/v1/refresh-tokens/${encodeURIComponent(refreshToken)}`,
      { method: "DELETE" },
    );
  } catch {
    // The disconnect still goes ahead.
  }
}
