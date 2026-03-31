import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ActivityWithMatch, MatchDetails } from "@/lib/types";
import StatCard from "@/components/StatCard";
import MatchCard from "@/components/MatchCard";
import RunCard from "@/components/RunCard";
import Sparkline from "@/components/Sparkline";
import SyncButton from "@/components/SyncButton";
import Link from "next/link";

export default async function Dashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Check if Strava is connected
  const { data: tokens } = await supabase
    .from("strava_tokens")
    .select("user_id")
    .eq("user_id", user.id)
    .single();

  const stravaConnected = !!tokens;

  // Rolling 4-week window
  const fourWeeksAgo = new Date();
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

  // Fetch activities with match details
  const { data: rawActivities } = await supabase
    .from("activities")
    .select("*, match_details(*)")
    .eq("user_id", user.id)
    .gte("started_at", fourWeeksAgo.toISOString())
    .order("started_at", { ascending: false });

  const activities: ActivityWithMatch[] = (rawActivities || []).map((a) => ({
    ...a,
    match_details: Array.isArray(a.match_details)
      ? a.match_details[0] || null
      : a.match_details,
  }));

  // Fetch standalone match details (no linked activity)
  const { data: standaloneMatches } = await supabase
    .from("match_details")
    .select("*")
    .eq("user_id", user.id)
    .is("activity_id", null)
    .gte("match_date", fourWeeksAgo.toISOString())
    .order("match_date", { ascending: false });

  // Split by type
  const matches = activities.filter((a) => a.activity_type === "match");
  const runs = activities.filter((a) => a.activity_type === "run");

  // All match details (linked + standalone)
  const allMatchDetails: MatchDetails[] = [
    ...matches.filter((m) => m.match_details).map((m) => m.match_details!),
    ...(standaloneMatches || []),
  ];

  // Stats
  const matchCount = allMatchDetails.length;
  const format7 = allMatchDetails.filter((m) => m.format === "7v7").length;
  const format11 = allMatchDetails.filter((m) => m.format === "11v11").length;

  const totalGoals = allMatchDetails.reduce((sum, m) => sum + m.goals, 0);
  const totalAssists = allMatchDetails.reduce((sum, m) => sum + m.assists, 0);
  const goalsPerMatch = matchCount > 0 ? (totalGoals / matchCount).toFixed(2) : "0";

  const ratings = allMatchDetails.filter((m) => m.rating).map((m) => m.rating!);
  const avgRating = ratings.length > 0
    ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)
    : "-";
  const bestRating = ratings.length > 0 ? Math.max(...ratings) : null;
  const bestRatingMatch = bestRating
    ? allMatchDetails.find((m) => m.rating === bestRating)
    : null;
  const bestRatingDate = bestRatingMatch
    ? new Date(bestRatingMatch.match_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "";

  const matchDistances = matches
    .filter((m) => m.distance_miles)
    .map((m) => m.distance_miles!);
  const runDistances = runs
    .filter((r) => r.distance_miles)
    .map((r) => r.distance_miles!);
  const avgMatchDist = matchDistances.length > 0
    ? (matchDistances.reduce((a, b) => a + b, 0) / matchDistances.length).toFixed(1)
    : "-";
  const avgRunDist = runDistances.length > 0
    ? (runDistances.reduce((a, b) => a + b, 0) / runDistances.length).toFixed(1)
    : "-";

  // Sparkline data: ratings over time
  const sparklineData = allMatchDetails
    .filter((m) => m.rating)
    .sort((a, b) => new Date(a.match_date).getTime() - new Date(b.match_date).getTime())
    .map((m) => ({
      date: m.match_date,
      value: m.rating!,
    }));

  // Date range for header
  const dateRange = `${fourWeeksAgo.toLocaleDateString("en-US", { month: "short", day: "numeric" })} \u2013 ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  return (
    <div className="min-h-screen p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Your season</h1>
          <p className="text-sm text-gray-500">{dateRange}</p>
        </div>
        <div className="flex items-center gap-3">
          {stravaConnected ? (
            <SyncButton />
          ) : (
            <a
              href="/api/strava/auth"
              className="text-sm bg-orange-500 text-white px-3 py-1.5 rounded-lg
                         hover:bg-orange-600 transition"
            >
              Connect Strava
            </a>
          )}
          <Link
            href="/log/new"
            className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg
                       hover:bg-blue-700 transition"
          >
            Log match
          </Link>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Matches played"
          value={matchCount}
          detail={matchCount > 0 ? `${format7}x 7v7 \u00b7 ${format11}x 11v11` : undefined}
        />
        <StatCard
          label="Goals / assists"
          value={`${totalGoals} / ${totalAssists}`}
          detail={matchCount > 0 ? `${goalsPerMatch} G per match` : undefined}
        />
        <StatCard
          label="Avg rating"
          value={avgRating}
          detail={bestRating ? `Best: ${bestRating} (${bestRatingDate})` : undefined}
        />
        <StatCard
          label="Avg distance"
          value={avgMatchDist !== "-" ? `${avgMatchDist} mi` : "-"}
          detail={avgRunDist !== "-" ? `Runs: ${avgRunDist} mi avg` : undefined}
        />
      </div>

      {/* Rating trend */}
      {sparklineData.length >= 2 && (
        <div className="mb-8">
          <p className="text-sm text-gray-500 mb-2">Rating trend</p>
          <Sparkline data={sparklineData} width={600} height={60} />
        </div>
      )}

      {/* Recent matches */}
      <div className="mb-8">
        <h2 className="text-lg font-bold mb-3">Recent matches</h2>
        {matches.length === 0 && (standaloneMatches || []).length === 0 ? (
          <p className="text-sm text-gray-500">No matches yet. Sync from Strava or log one manually.</p>
        ) : (
          <div className="space-y-3">
            {matches.map((activity) => (
              <MatchCard key={activity.id} activity={activity} />
            ))}
          </div>
        )}
      </div>

      {/* Recent runs */}
      <div>
        <h2 className="text-lg font-bold mb-3">Recent runs</h2>
        {runs.length === 0 ? (
          <p className="text-sm text-gray-500">No runs yet. Sync from Strava to see them here.</p>
        ) : (
          <div className="space-y-3">
            {runs.map((activity) => (
              <RunCard key={activity.id} activity={activity} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
