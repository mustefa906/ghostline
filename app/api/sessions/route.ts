import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: { founderId?: string; transcript?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "That request was not valid JSON." },
      { status: 400 },
    );
  }

  const founderId = (body.founderId ?? "").trim();
  const transcript = (body.transcript ?? "").trim();
  if (!founderId || !transcript) {
    return NextResponse.json(
      { error: "A session needs a founder and a transcript." },
      { status: 400 },
    );
  }

  const store = await getStore();
  const session = await store.createSession(founderId, transcript);
  return NextResponse.json({ session });
}

export async function PATCH(req: NextRequest) {
  let body: { id?: string; transcript?: string; status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "That request was not valid JSON." },
      { status: 400 },
    );
  }

  const id = (body.id ?? "").trim();
  if (!id) {
    return NextResponse.json(
      { error: "Pass a session id." },
      { status: 400 },
    );
  }

  const store = await getStore();
  const session = await store.updateSession(id, {
    transcript: body.transcript,
    status: body.status,
  });
  if (!session) {
    return NextResponse.json(
      { error: "That session was not found." },
      { status: 404 },
    );
  }
  return NextResponse.json({ session });
}
