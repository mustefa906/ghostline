import { NextRequest, NextResponse } from "next/server";
import { getStore, type DismissReason } from "@/lib/store";

export const runtime = "nodejs";

const DISMISS_REASONS: DismissReason[] = [
  "not a story",
  "too sensitive",
  "already posted",
];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let body: { status?: string; dismissReason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "That request was not valid JSON." },
      { status: 400 },
    );
  }
  if (body.status !== "dismissed" && body.status !== "used") {
    return NextResponse.json(
      { error: "Pass a status of dismissed or used." },
      { status: 400 },
    );
  }
  let dismissReason: DismissReason | null = null;
  if (body.status === "dismissed") {
    if (
      !DISMISS_REASONS.includes(body.dismissReason as DismissReason)
    ) {
      return NextResponse.json(
        {
          error:
            "Pass a reason: not a story, too sensitive, or already posted.",
        },
        { status: 400 },
      );
    }
    dismissReason = body.dismissReason as DismissReason;
  }
  const store = await getStore();
  const updated = await store.updateLead(id, {
    status: body.status,
    dismissReason,
  });
  if (!updated) {
    return NextResponse.json(
      { error: "That lead was not found." },
      { status: 404 },
    );
  }
  return NextResponse.json({ lead: updated });
}
