import { createServiceClient } from "./supabase/service";
import { StravaActivity } from "./types";

const STRAVA_API = "https://www.strava.com/api/v3";

// --- Pure helpers (exported for testing) ---

export function metersToMiles(m: number): number {
  return Math.round((m / 1609.34) * 100) / 100;
}

export function metersToFeet(m: number): number {
  return Math.round(m * 3.281 * 10) / 10;
}

export function calcPace(distMeters: number, timeSecs: number): string | null {
  if (!distMeters || !timeSecs) return null;
  const miles = distMeters / 1609.34;
  const totalMinsPerMile = timeSecs / 60 / miles;
  let mins = Math.floor(totalMinsPerMile);
  let secs = Math.round((totalMinsPerMile - mins) * 60);
  if (secs === 60) {
    mins += 1;
    secs = 0;
  }
  return `${mins}'${secs.toString().padStart(2, "0")}"/mi`;
}

export function isRelevantActivity(activity: StravaActivity): boolean {
  const { type, sport_type, name } = activity;
  const nameLower = (name || "").toLowerCase();

  if (type === "Run" || sport_type === "Run") return true;
  if (type === "Soccer" || sport_type === "Soccer") return true;
  if (nameLower.includes("soccer") || nameLower.includes("football")) return true;

  return false;
}

export function mapStravaActivity(
  stravaActivity: StravaActivity,
  userId: string
) {
  const isSoccer =
    stravaActivity.sport_type === "Soccer" ||
    stravaActivity.type === "Soccer" ||
    stravaActivity.name.toLowerCase().includes("soccer") ||
    stravaActivity.name.toLowerCase().includes("football");

  return {
    user_id: userId,
    strava_id: stravaActivity.id,
    activity_type: isSoccer ? ("match" as const) : ("run" as const),
    name: stravaActivity.name,
    started_at: stravaActivity.start_date,
    distance_miles: metersToMiles(stravaActivity.distance),
    duration_minutes: Math.round((stravaActivity.moving_time / 60) * 10) / 10,
    avg_pace: calcPace(stravaActivity.distance, stravaActivity.moving_time),
    avg_heart_rate: stravaActivity.average_heartrate
      ? Math.round(stravaActivity.average_heartrate)
      : null,
    max_heart_rate: stravaActivity.max_heartrate
      ? Math.round(stravaActivity.max_heartrate)
      : null,
    calories: stravaActivity.calories
      ? Math.round(stravaActivity.calories)
      : null,
    elevation_gain_ft: metersToFeet(stravaActivity.total_elevation_gain),
  };
}

// --- Server-side helpers (require Supabase + env) ---

export async function getValidToken(userId: string): Promise<string> {
  const db = createServiceClient();

  const { data: tokens } = await db
    .from("strava_tokens")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!tokens) throw new Error("No Strava tokens found");

  if (tokens.expires_at < Date.now() / 1000 + 300) {
    const res = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token: tokens.refresh_token,
      }),
    });

    if (!res.ok) {
      if (res.status === 401) {
        await db.from("strava_tokens").delete().eq("user_id", userId);
        throw new Error("STRAVA_TOKEN_REVOKED");
      }
      throw new Error(`Strava token refresh failed: ${res.status}`);
    }

    const refreshed = await res.json();

    await db
      .from("strava_tokens")
      .update({
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token,
        expires_at: refreshed.expires_at,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    return refreshed.access_token;
  }

  return tokens.access_token;
}

export async function fetchStravaActivities(
  accessToken: string,
  after?: number
): Promise<StravaActivity[]> {
  const params = new URLSearchParams({ per_page: "30" });
  if (after) params.set("after", after.toString());

  const res = await fetch(`${STRAVA_API}/athlete/activities?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) throw new Error(`Strava API error: ${res.status}`);
  return res.json();
}
