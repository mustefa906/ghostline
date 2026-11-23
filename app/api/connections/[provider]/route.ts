import { NextRequest, NextResponse } from "next/server";
import {
  decryptToken,
  getTokenKey,
  revokeGoogleToken,
  revokeHubSpotToken,
} from "@/lib/connections";
import { getStore, type ConnectionProvider } from "@/lib/store";

export const runtime = "nodejs";

// Disconnects a source. Revokes the token first (best effort), then
// deletes the stored connection and the leads that came from it.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  if (provider !== "google" && provider !== "hubspot") {
    return NextResponse.json(
      { error: "Pass a provider of google or hubspot." },
      { status: 400 },
    );
  }
  const founderId = req.nextUrl.searchParams.get("founderId");
  if (!founderId) {
    return NextResponse.json(
      { error: "Pass a founder id." },
      { status: 400 },
    );
  }
  const store = await getStore();
  const connections = await store.getConnections(founderId);
  const match = connections.find(
    (c) => c.provider === (provider as ConnectionProvider),
  );
  if (!match) {
    return NextResponse.json({ deleted: false });
  }
  const key = getTokenKey();
  if (key) {
    try {
      const refreshToken = decryptToken(match.refreshTokenEncrypted, key);
      if (provider === "google") {
        await revokeGoogleToken(refreshToken);
      } else {
        await revokeHubSpotToken(refreshToken);
      }
    } catch {
      // The disconnect still goes ahead.
    }
  }
  const deleted = await store.deleteConnection(
    founderId,
    provider as ConnectionProvider,
  );
  return NextResponse.json({ deleted });
}
