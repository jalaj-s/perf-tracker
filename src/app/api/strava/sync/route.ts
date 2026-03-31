import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";
import {
  getValidToken,
  fetchStravaActivities,
  mapStravaActivity,
  isRelevantActivity,
} from "@/lib/strava";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const serviceDb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() { return []; },
        setAll() {},
      },
    }
  );

  try {
    const accessToken = await getValidToken(user.id);

    const { data: latest } = await serviceDb
      .from("activities")
      .select("started_at")
      .eq("user_id", user.id)
      .order("started_at", { ascending: false })
      .limit(1)
      .single();

    const after = latest
      ? Math.floor(new Date(latest.started_at).getTime() / 1000)
      : undefined;

    const stravaActivities = await fetchStravaActivities(accessToken, after);

    const mapped = stravaActivities
      .filter(isRelevantActivity)
      .map((a) => mapStravaActivity(a, user.id));

    if (mapped.length === 0) {
      return NextResponse.json({ synced: 0, message: "Already up to date" });
    }

    const { data, error } = await serviceDb
      .from("activities")
      .upsert(mapped, { onConflict: "user_id,strava_id" })
      .select();

    if (error) throw error;

    return NextResponse.json({ synced: data?.length || 0 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";

    if (message === "STRAVA_TOKEN_REVOKED") {
      return NextResponse.json(
        { error: "Strava access revoked. Please reconnect.", reconnect: true },
        { status: 401 }
      );
    }

    console.error("Sync error:", message);
    return NextResponse.json(
      { error: "Sync failed", details: message },
      { status: 500 }
    );
  }
}
