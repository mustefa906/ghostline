import { NextResponse } from "next/server";
import {
  DEMO_DRAFT,
  DEMO_FINGERPRINT_POSTS,
  DEMO_FOUNDER,
  DEMO_SOURCE_NOTE,
  DEMO_TRANSCRIPT,
  demoScheduledFor,
} from "@/lib/demo-seed";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";

// One-click demo mode. Seeds a demo founder, three fingerprint posts, and
// one finished example draft. Idempotent: calling it twice returns the same
// demo founder without duplicating anything.
export async function POST() {
  const store = await getStore();

  let founder = await store.findFounderByName(DEMO_FOUNDER.name);
  if (!founder) {
    founder = await store.createFounder(
      DEMO_FOUNDER.name,
      DEMO_FOUNDER.linkedinUrl,
    );
  }

  const existing = await store.getFingerprint(founder.id);
  if (existing.length === 0) {
    await store.saveFingerprint(founder.id, DEMO_FINGERPRINT_POSTS);
  }

  const drafts = await store.listDrafts(founder.id);
  if (drafts.length === 0) {
    const session = await store.createSession(founder.id, DEMO_TRANSCRIPT);
    await store.updateSession(session.id, { status: "done" });
    await store.createDraft({
      sessionId: session.id,
      founderId: founder.id,
      body: DEMO_DRAFT,
      sourceNote: DEMO_SOURCE_NOTE,
      version: "original",
      scheduledFor: demoScheduledFor(),
    });
  }

  return NextResponse.json({
    founder,
    fingerprint: DEMO_FINGERPRINT_POSTS,
    demo: true,
  });
}

export async function GET() {
  const store = await getStore();
  const founder = await store.findFounderByName(DEMO_FOUNDER.name);
  if (!founder) {
    return NextResponse.json({ demo: false });
  }
  const fingerprint = await store.getFingerprint(founder.id);
  const drafts = await store.listDrafts(founder.id);
  return NextResponse.json({ demo: true, founder, fingerprint, drafts });
}
