import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: { name?: string; linkedinUrl?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "That request was not valid JSON." },
      { status: 400 },
    );
  }

  const name = (body.name ?? "").trim();
  if (!name) {
    return NextResponse.json(
      { error: "Add your name so the drafts know who they are for." },
      { status: 400 },
    );
  }

  const linkedinUrl = (body.linkedinUrl ?? "").trim() || null;
  const store = await getStore();
  const founder = await store.createFounder(name, linkedinUrl);
  return NextResponse.json({ founder });
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json(
      { error: "Pass a founder id." },
      { status: 400 },
    );
  }
  const store = await getStore();
  const founder = await store.getFounder(id);
  if (!founder) {
    return NextResponse.json(
      { error: "That founder was not found." },
      { status: 404 },
    );
  }
  const fingerprint = await store.getFingerprint(id);
  return NextResponse.json({ founder, fingerprint });
}
