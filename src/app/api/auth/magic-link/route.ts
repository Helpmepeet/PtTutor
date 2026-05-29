import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { isEmailAllowed } from "@/lib/server/auth";
import { serverEnv, supabaseServerConfigured } from "@/lib/server/env";

export async function POST(request: Request) {
  const { email } = (await request.json().catch(() => ({}))) as {
    email?: string;
  };

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  if (!isEmailAllowed(email)) {
    return NextResponse.json({ error: "Email is not allowed" }, { status: 403 });
  }

  if (!supabaseServerConfigured()) {
    return NextResponse.json({
      demo: true,
      message:
        "Supabase credentials are missing. Local demo mode is available, but real magic links are not configured."
    });
  }

  const supabase = createClient(
    serverEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: new URL("/auth/callback", request.url).toString()
    }
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
