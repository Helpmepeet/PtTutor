import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server/auth";
import { jsonError } from "@/lib/server/http";
import { generateScenarioDraft } from "@/lib/server/llm";

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    const { prompt } = (await request.json().catch(() => ({}))) as {
      prompt?: string;
    };

    if (!prompt || prompt.trim().length < 5) {
      return NextResponse.json(
        { error: "prompt must be at least 5 characters" },
        { status: 400 }
      );
    }

    const scenario = await generateScenarioDraft(user.id, prompt.trim());
    return NextResponse.json({ scenario });
  } catch (error) {
    return jsonError(error);
  }
}
