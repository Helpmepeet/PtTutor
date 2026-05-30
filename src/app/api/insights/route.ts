import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server/auth";
import { getRoleplayStore } from "@/lib/server/get-store";
import { aggregateInsights } from "@/lib/insights";
import { jsonError } from "@/lib/server/http";

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    const rows = await getRoleplayStore().getInsightRows(user.id);
    return NextResponse.json({ insights: aggregateInsights(rows) });
  } catch (error) {
    return jsonError(error);
  }
}
