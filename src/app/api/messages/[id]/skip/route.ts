import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server/auth";
import { getRoleplayStore } from "@/lib/server/get-store";
import { jsonError } from "@/lib/server/http";
import { getRouteId, type IdRouteContext } from "../../../route-context";

export async function POST(request: Request, context: IdRouteContext) {
  try {
    const user = await getAuthenticatedUser(request);
    const id = await getRouteId(context);
    const store = getRoleplayStore();
    const found = await store.getSessionForMessage(user.id, id);

    if (!found) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    await store.updateUserMessage(user.id, id, {
      actor_status: "skipped",
      actor_error: null
    });

    const session = await store.getSession(user.id, found.session.id);
    return NextResponse.json({ session });
  } catch (error) {
    return jsonError(error);
  }
}
