import { NextRequest, NextResponse } from "next/server";
import { getWeekMonday } from "@/lib/harvest";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const founderId = req.nextUrl.searchParams.get("founderId");
  if (!founderId) {
    return NextResponse.json(
      { error: "Pass a founder id." },
      { status: 400 },
    );
  }
  const week = req.nextUrl.searchParams.get("week") ?? getWeekMonday();
  const store = await getStore();
  const leads = await store.listLeads(founderId, week);
  return NextResponse.json({ leads });
}
