import { NextRequest, NextResponse } from "next/server";
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
  const store = await getStore();
  const posts = await store.listDrafts(founderId);
  return NextResponse.json({ posts });
}

export async function POST(req: NextRequest) {
  let body: {
    founderId?: string;
    sessionId?: string | null;
    body?: string;
    sourceNote?: string;
    version?: string;
    scheduledFor?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "That request was not valid JSON." },
      { status: 400 },
    );
  }

  const founderId = (body.founderId ?? "").trim();
  const text = (body.body ?? "").trim();
  if (!founderId || !text) {
    return NextResponse.json(
      { error: "A draft needs a founder and some text." },
      { status: 400 },
    );
  }

  const store = await getStore();
  const draft = await store.createDraft({
    founderId,
    sessionId: body.sessionId ?? null,
    body: text,
    sourceNote: (body.sourceNote ?? "").trim(),
    version: (body.version ?? "original").trim(),
    scheduledFor: body.scheduledFor ?? null,
  });
  return NextResponse.json({ draft });
}

export async function PATCH(req: NextRequest) {
  let body: {
    id?: string;
    editedBody?: string | null;
    status?: string;
    scheduledFor?: string | null;
  };
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
      { error: "Pass a draft id." },
      { status: 400 },
    );
  }

  const store = await getStore();
  const draft = await store.updateDraft(id, {
    editedBody: body.editedBody,
    status: body.status,
    scheduledFor: body.scheduledFor,
  });
  if (!draft) {
    return NextResponse.json(
      { error: "That draft was not found." },
      { status: 404 },
    );
  }
  return NextResponse.json({ draft });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json(
      { error: "Pass a draft id." },
      { status: 400 },
    );
  }
  const store = await getStore();
  const removed = await store.deleteDraft(id);
  if (!removed) {
    return NextResponse.json(
      { error: "That draft was not found." },
      { status: 404 },
    );
  }
  return NextResponse.json({ removed: true });
}
