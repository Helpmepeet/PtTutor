import { NextResponse } from "next/server";
import { parseCreateScenarioInput } from "@/lib/scenario-input";
import { getAuthenticatedUser } from "@/lib/server/auth";
import { getRoleplayStore } from "@/lib/server/get-store";
import { jsonError } from "@/lib/server/http";

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    const scenarios = await getRoleplayStore().listScenarios(user.id);
    return NextResponse.json({ scenarios });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    let input;
    try {
      input = parseCreateScenarioInput(await request.json());
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Invalid scenario" },
        { status: 400 }
      );
    }
    const scenario = await getRoleplayStore().createScenario(user, input);
    return NextResponse.json({ scenario }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
