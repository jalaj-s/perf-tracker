import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import MatchForm from "@/components/MatchForm";
import { Activity, League } from "@/lib/types";

export default async function LogMatchPage({
  params,
}: {
  params: Promise<{ activityId: string }>;
}) {
  const { activityId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: activity } = await supabase
    .from("activities")
    .select("*")
    .eq("id", activityId)
    .eq("user_id", user.id)
    .single();

  if (!activity) redirect("/");

  const { data: leagues } = await supabase
    .from("leagues")
    .select("*")
    .eq("user_id", user.id)
    .order("name");

  return (
    <div className="min-h-screen p-6 max-w-2xl mx-auto">
      <Link href="/" className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-block">
        &larr; Back to dashboard
      </Link>
      <h1 className="text-2xl font-bold mb-6">Log match details</h1>
      <MatchForm activity={activity as Activity} initialLeagues={leagues || []} />
    </div>
  );
}
