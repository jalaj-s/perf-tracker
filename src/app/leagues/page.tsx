import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import LeagueManager from "@/components/LeagueManager";
import { League } from "@/lib/types";

export default async function LeaguesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: leaguesData } = await supabase
    .from("leagues")
    .select("*")
    .eq("user_id", user.id)
    .order("name");

  const leagues: League[] = leaguesData || [];

  const { data: matchRows } = await supabase
    .from("match_details")
    .select("league_id")
    .eq("user_id", user.id);

  const matchCountByLeague: Record<string, number> = {};
  for (const row of matchRows || []) {
    if (row.league_id) {
      matchCountByLeague[row.league_id] = (matchCountByLeague[row.league_id] || 0) + 1;
    }
  }

  return (
    <div className="min-h-screen px-4 py-5 sm:p-6 max-w-2xl mx-auto">
      <Link href="/" className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-block">
        &larr; Back to dashboard
      </Link>
      <h1 className="text-2xl font-bold mb-6">Manage leagues</h1>

      {leagues.length === 0 ? (
        <p className="text-sm text-gray-500">
          You don&apos;t have any leagues yet. Create one when you log a match.
        </p>
      ) : (
        <LeagueManager initialLeagues={leagues} matchCountByLeague={matchCountByLeague} />
      )}
    </div>
  );
}
