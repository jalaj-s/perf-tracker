import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  getValidToken,
  fetchStravaActivity,
  getUserByAthleteId,
  isRelevantActivity,
  mapStravaActivity,
} from "@/lib/strava";

const VERIFY_TOKEN = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN || "perf-tracker-webhook";

// Strava subscription validation (GET)
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN.trim() && challenge) {
    return NextResponse.json({ "hub.challenge": challenge });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// Strava event receiver (POST)
export async function POST(request: Request) {
  const body = await request.json();

  // Only handle activity creation and updates
  if (body.object_type !== "activity") {
    return NextResponse.json({ ok: true });
  }

  if (body.aspect_type !== "create" && body.aspect_type !== "update") {
    return NextResponse.json({ ok: true });
  }

  const stravaActivityId: number = body.object_id;
  const athleteId: number = body.owner_id;

  try {
    // Look up our user by their Strava athlete ID
    const user = await getUserByAthleteId(athleteId);
    if (!user) {
      return NextResponse.json({ ok: true }); // Unknown athlete, ignore
    }

    const accessToken = await getValidToken(user.user_id);
    const stravaActivity = await fetchStravaActivity(accessToken, stravaActivityId);

    if (!isRelevantActivity(stravaActivity)) {
      return NextResponse.json({ ok: true }); // Not a run or soccer activity
    }

    const mapped = mapStravaActivity(stravaActivity, user.user_id);
    const db = createServiceClient();

    await db
      .from("activities")
      .upsert(mapped, { onConflict: "user_id,strava_id" });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Webhook processing error:", err);
    // Always return 200 to Strava so they don't disable the subscription
    return NextResponse.json({ ok: true });
  }
}
