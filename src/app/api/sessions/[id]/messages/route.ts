import { getAuthenticatedUser } from "@/lib/server/auth";
import { getRoleplayStore } from "@/lib/server/get-store";
import { jsonError } from "@/lib/server/http";
import {
  generateActorReplyStream,
  generateReviewerOutput
} from "@/lib/server/llm";
import { getRouteId, type IdRouteContext } from "../../../route-context";

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: Request, context: IdRouteContext) {
  try {
    const user = await getAuthenticatedUser(request);
    const id = await getRouteId(context);
    const { client_message_id, content } = (await request.json()) as {
      client_message_id?: string;
      content?: string;
    };

    if (!client_message_id || !content?.trim()) {
      return new Response(
        JSON.stringify({ error: "client_message_id and content are required" }),
        { status: 400, headers: { "content-type": "application/json" } }
      );
    }

    const store = getRoleplayStore();
    let session = await store.getSession(user.id, id);
    if (!session) {
      return new Response(
        JSON.stringify({ error: "Session not found" }),
        { status: 404, headers: { "content-type": "application/json" } }
      );
    }

    const scenario = await store.getScenario(user.id, session.scenario_id);
    if (!scenario) {
      return new Response(
        JSON.stringify({ error: "Scenario not found" }),
        { status: 404, headers: { "content-type": "application/json" } }
      );
    }

    const userMessage = await store.createUserMessage(user.id, {
      sessionId: id,
      clientMessageId: client_message_id,
      content: content.trim()
    });

    session = (await store.getSession(user.id, id)) ?? session;
    const messagesWithLatest = session.messages;

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        function send(event: string, data: unknown) {
          controller.enqueue(encoder.encode(sseEvent(event, data)));
        }

        // 1. Immediately send the user message so the client sees it
        send("user_message", { message: userMessage });

        // 2. Run actor (streaming) + reviewer (structured, non-streaming) in parallel
        let actorText = "";
        const actorNarrations: string[] = [];
        const actorPromise = (async () => {
          try {
            const actorStream = generateActorReplyStream(
              user.id,
              scenario,
              messagesWithLatest,
              session.actor_level
            );
            for await (const event of actorStream) {
              if (event.type === "narration") {
                actorNarrations.push(event.text);
                send("narration", { text: event.text });
              } else {
                actorText += event.text;
                send("actor_delta", { text: event.text });
              }
            }
            const actorMessage = await store.createActorMessage(user.id, {
              sessionId: id,
              parentUserMessageId: userMessage.id,
              content: actorText,
              narrations: actorNarrations.length ? actorNarrations : undefined
            });
            await store.updateUserMessage(user.id, userMessage.id, {
              actor_status: "succeeded",
              actor_error: null
            });
            send("actor_done", { message: actorMessage });
          } catch (error) {
            await store.updateUserMessage(user.id, userMessage.id, {
              actor_status: "failed",
              actor_error:
                error instanceof Error ? error.message : "Actor failed"
            });
            send("actor_error", {
              error: error instanceof Error ? error.message : "Actor failed"
            });
          }
        })();

        const reviewerPromise = (async () => {
          try {
            const reviewerOutput = await generateReviewerOutput(
              user.id,
              scenario,
              messagesWithLatest,
              userMessage,
              session.reviewer_feedback_mode
            );
            await store.updateUserMessage(user.id, userMessage.id, {
              reviewer_status: "succeeded",
              reviewer_error: null,
              reviewer_output: reviewerOutput
            });
            send("reviewer_done", { reviewer_output: reviewerOutput });
          } catch (error) {
            await store.updateUserMessage(user.id, userMessage.id, {
              reviewer_status: "failed",
              reviewer_error:
                error instanceof Error ? error.message : "Reviewer failed"
            });
            send("reviewer_error", {
              error:
                error instanceof Error ? error.message : "Reviewer failed"
            });
          }
        })();

        await Promise.allSettled([actorPromise, reviewerPromise]);

        // 3. Send the final reconciled session state
        const updatedSession = await store.getSession(user.id, id);
        send("session", { session: updatedSession });

        controller.close();
      }
    });

    return new Response(stream, {
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        connection: "keep-alive"
      }
    });
  } catch (error) {
    return jsonError(error);
  }
}
