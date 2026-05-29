import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server/auth";
import { getRoleplayStore } from "@/lib/server/get-store";
import { jsonError } from "@/lib/server/http";
import {
  generateActorReply,
  generateReviewerOutput
} from "@/lib/server/llm";
import { getRouteId, type IdRouteContext } from "../../../route-context";

export async function POST(request: Request, context: IdRouteContext) {
  try {
    const user = await getAuthenticatedUser(request);
    const id = await getRouteId(context);
    const { target } = (await request.json().catch(() => ({}))) as {
      target?: "actor" | "reviewer" | "both";
    };

    const store = getRoleplayStore();
    const found = await store.getSessionForMessage(user.id, id);
    if (!found) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    const scenario = await store.getScenario(user.id, found.session.scenario_id);
    if (!scenario) {
      return NextResponse.json({ error: "Scenario not found" }, { status: 404 });
    }

    const retryActor =
      target === "actor" ||
      target === "both" ||
      (!target && found.message.actor_status === "failed");
    const retryReviewer =
      target === "reviewer" ||
      target === "both" ||
      (!target && found.message.reviewer_status === "failed");

    if (retryActor) {
      try {
        const { content, narrations } = await generateActorReply(
          user.id,
          scenario,
          found.session.messages
        );
        await store.createActorMessage(user.id, {
          sessionId: found.session.id,
          parentUserMessageId: found.message.id,
          content,
          narrations: narrations.length ? narrations : undefined
        });
        await store.updateUserMessage(user.id, found.message.id, {
          actor_status: "succeeded",
          actor_error: null,
          actor_retry_count: (found.message.actor_retry_count ?? 0) + 1
        });
      } catch (error) {
        await store.updateUserMessage(user.id, found.message.id, {
          actor_status: "failed",
          actor_error:
            error instanceof Error ? error.message : "Actor retry failed",
          actor_retry_count: (found.message.actor_retry_count ?? 0) + 1
        });
      }
    }

    if (retryReviewer) {
      try {
        const output = await generateReviewerOutput(
          user.id,
          scenario,
          found.session.messages,
          found.message
        );
        await store.updateUserMessage(user.id, found.message.id, {
          reviewer_status: "succeeded",
          reviewer_error: null,
          reviewer_output: output,
          reviewer_retry_count: (found.message.reviewer_retry_count ?? 0) + 1
        });
      } catch (error) {
        await store.updateUserMessage(user.id, found.message.id, {
          reviewer_status: "failed",
          reviewer_error:
            error instanceof Error ? error.message : "Reviewer retry failed",
          reviewer_retry_count: (found.message.reviewer_retry_count ?? 0) + 1
        });
      }
    }

    const session = await store.getSession(user.id, found.session.id);
    return NextResponse.json({ session });
  } catch (error) {
    return jsonError(error);
  }
}
