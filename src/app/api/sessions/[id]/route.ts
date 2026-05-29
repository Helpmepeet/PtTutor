import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server/auth";
import { getRoleplayStore } from "@/lib/server/get-store";
import { jsonError } from "@/lib/server/http";
import { getRouteId, type IdRouteContext } from "../../route-context";

export async function GET(request: Request, context: IdRouteContext) {
  try {
    const user = await getAuthenticatedUser(request);
    const id = await getRouteId(context);
    const session = await getRoleplayStore().getSession(user.id, id);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    return NextResponse.json({ session });
  } catch (error) {
    return jsonError(error);
  }
}

const VALID_FEEDBACK_MODES = ["light", "standard", "strict"] as const;
type FeedbackMode = typeof VALID_FEEDBACK_MODES[number];

export async function PATCH(request: Request, context: IdRouteContext) {
  try {
    const user = await getAuthenticatedUser(request);
    const id = await getRouteId(context);
    const body = (await request.json()) as { title?: string; reviewer_feedback_mode?: string };

    const updateInput: { title?: string; reviewer_feedback_mode?: FeedbackMode } = {};

    if (body.title !== undefined) {
      if (!body.title.trim()) {
        return NextResponse.json({ error: "title cannot be empty" }, { status: 400 });
      }
      updateInput.title = body.title.trim();
    }

    if (body.reviewer_feedback_mode !== undefined) {
      if (!VALID_FEEDBACK_MODES.includes(body.reviewer_feedback_mode as FeedbackMode)) {
        return NextResponse.json({ error: "invalid reviewer_feedback_mode" }, { status: 400 });
      }
      updateInput.reviewer_feedback_mode = body.reviewer_feedback_mode as FeedbackMode;
    }

    if (Object.keys(updateInput).length === 0) {
      return NextResponse.json({ error: "nothing to update" }, { status: 400 });
    }

    const session = await getRoleplayStore().updateSession(user.id, id, updateInput);
    return NextResponse.json({ session });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request, context: IdRouteContext) {
  try {
    const user = await getAuthenticatedUser(request);
    const id = await getRouteId(context);
    await getRoleplayStore().deleteSession(user.id, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
