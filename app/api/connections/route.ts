import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";

// Lists the founder's connections with public fields only. Tokens are
// never returned.
export async function GET(req: NextRequest) {
  const founderId = req.nextUrl.searchParams.get("founderId");
  if (!founderId) {
    return NextResponse.json(
      { error: "Pass a founder id." },
      { status: 400 },
    );
  }
  const store = await getStore();
  const connections = await store.getConnections(founderId);
  return NextResponse.json({
    connections: connections.map((c) => ({
      id: c.id,
      provider: c.provider,
      accountLabel: c.accountLabel,
      status: c.status,
      createdAt: c.createdAt,
    })),
  });
}
