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
  const posts = await store.getFingerprint(founderId);
  return NextResponse.json({ posts });
}

export async function POST(req: NextRequest) {
  let body: { founderId?: string; posts?: string[] };
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
      { error: "Pass a founder id." },
      { status: 400 },
    );
  }
  const posts = (Array.isArray(body.posts) ? body.posts : [])
    .map((p) => String(p).trim())
    .filter((p) => p.length > 0)
    .slice(0, 5);

  const store = await getStore();
  const founder = await store.getFounder(founderId);
  if (!founder) {
    return NextResponse.json(
      { error: "That founder was not found." },
      { status: 404 },
    );
  }
  await store.saveFingerprint(founderId, posts);
  return NextResponse.json({
    posts,
    warning:
      posts.length < 3
        ? "Fewer than 3 posts were saved, so the voice match will be weaker."
        : null,
  });
}
