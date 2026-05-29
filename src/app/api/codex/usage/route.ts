import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server/auth";
import { loadUsageSnapshot } from "@/lib/server/codex/persistence";
import { jsonError } from "@/lib/server/http";

// Returns the signed-in user's latest ChatGPT/Codex subscription usage snapshot
// (5-hour primary + weekly secondary windows), captured from backend response
// headers. `usage` is null until the user has made at least one call.
export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    const usage = await loadUsageSnapshot(user.id);
    return NextResponse.json({ usage });
  } catch (error) {
    return jsonError(error);
  }
}
