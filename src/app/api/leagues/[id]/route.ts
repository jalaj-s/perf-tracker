import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

async function authedUserId() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
}

// PATCH: update league fields
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await authedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  const updates: Record<string, unknown> = {};
  if (typeof body.name === "string") {
    const trimmed = body.name.trim();
    if (!trimmed) {
      return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
    }
    updates.name = trimmed;
  }
  if (typeof body.format === "string") {
    if (!["7v7", "11v11"].includes(body.format)) {
      return NextResponse.json({ error: "Format must be 7v7 or 11v11" }, { status: 400 });
    }
    updates.format = body.format;
  }
  if ("location" in body) {
    updates.location = body.location?.trim() || null;
  }
  if ("organizer" in body) {
    updates.organizer = body.organizer?.trim() || null;
  }
  if (typeof body.is_coed === "boolean") {
    updates.is_coed = body.is_coed;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const serviceDb = createServiceClient();
  const { data, error } = await serviceDb
    .from("leagues")
    .update(updates)
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "A league with that name already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "League not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}

// DELETE: remove a league, but only if no matches reference it
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await authedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const serviceDb = createServiceClient();

  const { count, error: countError } = await serviceDb
    .from("match_details")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("league_id", id);

  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 });
  }

  if ((count ?? 0) > 0) {
    return NextResponse.json(
      {
        error: `${count} match${count === 1 ? "" : "es"} still reference this league. Delete or reassign them first.`,
        matchCount: count,
      },
      { status: 409 }
    );
  }

  const { error } = await serviceDb
    .from("leagues")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
