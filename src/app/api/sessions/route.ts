import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server/auth";
import { getRoleplayStore } from "@/lib/server/get-store";
import { jsonError } from "@/lib/server/http";
import { generateActorStarter } from "@/lib/server/llm";

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    const sessions = await getRoleplayStore().listSessions(user.id);
    return NextResponse.json({ sessions });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    const { scenario_id, actor_level } = (await request.json()) as {
      scenario_id?: string;
      actor_level?: string;
    };

    if (!scenario_id) {
      return NextResponse.json(
        { error: "scenario_id is required" },
        { status: 400 }
      );
    }

    const validActorLevels = ["easy", "standard", "challenging"] as const;
    const resolvedActorLevel = validActorLevels.includes(actor_level as typeof validActorLevels[number])
      ? (actor_level as typeof validActorLevels[number])
      : "standard";

    const store = getRoleplayStore();
    let session = await store.createSession({
      user,
      scenarioId: scenario_id,
      actorLevel: resolvedActorLevel
    });
    const scenario = await store.getScenario(user.id, scenario_id);

    if (scenario?.starter === "actor") {
      const content = await generateActorStarter(user.id, scenario, resolvedActorLevel);
      await store.createActorMessage(user.id, {
        sessionId: session.id,
        parentUserMessageId: null,
        content
      });
      session = (await store.getSession(user.id, session.id)) ?? session;
    }

    return NextResponse.json({ session });
  } catch (error) {
    return jsonError(error);
  }
}
