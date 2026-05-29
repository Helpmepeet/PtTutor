import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server/auth";
import { getAuthStatus } from "@/lib/server/codex/token-store";
import { jsonError } from "@/lib/server/http";

// Reports whether the signed-in user has linked their OpenAI account, without
// exposing any token material. account_id is a backend identifier, not a
// secret, and confirms which subscription is bound.
export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    const status = await getAuthStatus(user.id);
    return NextResponse.json(status);
  } catch (error) {
    return jsonError(error);
  }
}
