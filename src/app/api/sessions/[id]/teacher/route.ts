import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server/auth";
import { getRoleplayStore } from "@/lib/server/get-store";
import { jsonError } from "@/lib/server/http";
import { generateTeacherReplyStream } from "@/lib/server/llm";
import { getRouteId, type IdRouteContext } from "../../../route-context";

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(request: Request, context: IdRouteContext) {
  try {
    const user = await getAuthenticatedUser(request);
    const id = await getRouteId(context);
    const session = await getRoleplayStore().getSession(user.id, id);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    return NextResponse.json({ teacher_messages: session.teacher_messages });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request, context: IdRouteContext) {
  try {
    const user = await getAuthenticatedUser(request);
    const id = await getRouteId(context);
    const { question } = (await request.json()) as { question?: string };

    if (!question?.trim()) {
      return new Response(
        JSON.stringify({ error: "question is required" }),
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

    const priorTeacherMessages = session.teacher_messages;
    const userTeacherMessage = await store.createTeacherMessage(user.id, {
      sessionId: id,
      role: "user",
      content: question.trim()
    });

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        function send(event: string, data: unknown) {
          controller.enqueue(encoder.encode(sseEvent(event, data)));
        }

        // 1. Confirm the user message was saved
        send("user_message", { message: userTeacherMessage });

        // 2. Stream the teacher's reply
        let teacherText = "";
        try {
          const teacherStream = generateTeacherReplyStream({
            userId: user.id,
            scenario,
            messages: session!.messages,
            teacherMessages: priorTeacherMessages,
            question: question.trim()
          });

          for await (const delta of teacherStream) {
            teacherText += delta;
            send("teacher_delta", { text: delta });
          }

          const teacherMessage = await store.createTeacherMessage(user.id, {
            sessionId: id,
            role: "teacher",
            content: teacherText
          });

          send("teacher_done", { message: teacherMessage });
        } catch (error) {
          send("teacher_error", {
            error:
              error instanceof Error ? error.message : "Teacher failed"
          });
        }

        // 3. Send reconciled session
        session = (await store.getSession(user.id, id)) ?? session!;
        send("session", { session });

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
