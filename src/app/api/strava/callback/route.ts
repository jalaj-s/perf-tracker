import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.json({ error: "No code provided" }, { status: 400 });
  }

  // Verify CSRF state
  const state = req.nextUrl.searchParams.get("state");
  const storedState = req.cookies.get("strava_oauth_state")?.value;
  if (!state || state !== storedState) {
    return NextResponse.json({ error: "Invalid OAuth state" }, { status: 403 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const tokenRes = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
    }),
  });

  const tokenData = await tokenRes.json();

  if (!tokenRes.ok) {
    return NextResponse.json(
      { error: "Token exchange failed", details: tokenData },
      { status: 400 }
    );
  }

  const serviceDb = createServiceClient();

  const { error } = await serviceDb.from("strava_tokens").upsert(
    {
      user_id: user.id,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: tokenData.expires_at,
      strava_athlete_id: tokenData.athlete?.id ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) {
    return NextResponse.json(
      { error: "Failed to store tokens", details: error.message },
      { status: 500 }
    );
  }

  // Clear the OAuth state cookie
  const response = NextResponse.redirect(new URL("/", req.url));
  response.cookies.delete("strava_oauth_state");
  return response;
}
