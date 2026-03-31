import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

// GET: fetch activities with optional type filter
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const type = searchParams.get("type");

  let query = supabase
    .from("activities")
    .select("*, match_details(*)")
    .eq("user_id", user.id)
    .order("started_at", { ascending: false });

  if (type) {
    query = query.eq("activity_type", type);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Flatten match_details from array to single object or null
  const activities = (data || []).map((a) => ({
    ...a,
    match_details: Array.isArray(a.match_details)
      ? a.match_details[0] || null
      : a.match_details,
  }));

  return NextResponse.json(activities);
}

// POST: save or update match details
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json();

  // Service role needed for upsert on activity_id (unique constraint)
  const serviceDb = createServiceClient();

  // If linking to an activity, verify it belongs to this user
  if (body.activity_id) {
    const { data: activity } = await serviceDb
      .from("activities")
      .select("id, started_at")
      .eq("id", body.activity_id)
      .eq("user_id", user.id)
      .single();

    if (!activity) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    }

    // Copy started_at to match_date for linked matches
    body.match_date = body.match_date || activity.started_at;
  }

  const matchData = {
    activity_id: body.activity_id || null,
    user_id: user.id,
    format: body.format,
    league: body.league || null,
    position: body.position || null,
    goals: body.goals ?? 0,
    assists: body.assists ?? 0,
    rating: body.rating ?? null,
    result: body.result || null,
    notes: body.notes || null,
    match_date: body.match_date,
  };

  // Upsert by activity_id if linking, otherwise insert
  let query;
  if (body.activity_id) {
    query = serviceDb
      .from("match_details")
      .upsert(matchData, { onConflict: "activity_id" })
      .select()
      .single();
  } else {
    query = serviceDb
      .from("match_details")
      .insert(matchData)
      .select()
      .single();
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
