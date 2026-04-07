import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ActivityWithMatch, League, MatchDetailsWithLeague } from "@/lib/types";
import StatCard from "@/components/StatCard";
import MatchCard from "@/components/MatchCard";
import RunCard from "@/components/RunCard";
import Sparkline from "@/components/Sparkline";
import SyncButton from "@/components/SyncButton";
import RangePicker from "@/components/RangePicker";
import LeagueFilter from "@/components/LeagueFilter";
import InsightCard from "@/components/InsightCard";
import { computeFormatInsight, computeLeagueInsight, computeRecoveryInsight, computeFitnessInsight } from "@/lib/insights";
import Link from "next/link";
import SignOutButton from "@/components/SignOutButton";

function getDateRange(range: string): { start: Date | null; label: string } {
  const now = new Date();
  switch (range) {
    case "3m": {
      const d = new Date();
      d.setMonth(d.getMonth() - 3);
      return { start: d, label: `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} \u2013 ${now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` };
    }
    case "6m": {
      const d = new Date();
      d.setMonth(d.getMonth() - 6);
      return { start: d, label: `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} \u2013 ${now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` };
    }
    case "1y": {
      const d = new Date();
      d.setFullYear(d.getFullYear() - 1);
      return { start: d, label: `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} \u2013 ${now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` };
    }
    case "all":
      return { start: null, label: "All time" };
    default: {
      const d = new Date();
      d.setDate(d.getDate() - 28);
      return { start: d, label: `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} \u2013 ${now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` };
    }
  }
}

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; league?: string }>;
}) {
  const { range: rangeParam, league: leagueParam } = await searchParams;
  const range = rangeParam || "4w";
  const leagueFilter = leagueParam || "all";
  const { start, label: dateRange } = getDateRange(range);

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

  // Fetch user's leagues for the filter
  const { data: userLeagues } = await supabase
    .from("leagues")
    .select("*")
    .eq("user_id", user.id)
    .order("name");

  const leagues: League[] = userLeagues || [];

  // Fetch activities with match details
  let activitiesQuery = supabase
    .from("activities")
    .select("*, match_details(*, league:leagues(*))")
    .eq("user_id", user.id)
    .order("started_at", { ascending: false });

  if (start) {
    activitiesQuery = activitiesQuery.gte("started_at", start.toISOString());
  }

  const { data: rawActivities } = await activitiesQuery;

  const activities: ActivityWithMatch[] = (rawActivities || []).map((a) => ({
    ...a,
    match_details: Array.isArray(a.match_details)
      ? a.match_details[0] || null
      : a.match_details,
  }));

  // Fetch standalone match details (no linked activity)
  let standaloneQuery = supabase
    .from("match_details")
    .select("*, league:leagues(*)")
    .eq("user_id", user.id)
    .is("activity_id", null)
    .order("match_date", { ascending: false });

  if (start) {
    standaloneQuery = standaloneQuery.gte("match_date", start.toISOString());
  }

  const { data: standaloneMatches } = await standaloneQuery;

  // Apply league filter
  const filteredActivities = leagueFilter === "all"
    ? activities
    : activities.filter((a) =>
        a.activity_type === "run" || a.match_details?.league_id === leagueFilter
      );
  const filteredStandalone = leagueFilter === "all"
    ? (standaloneMatches || [])
    : (standaloneMatches || []).filter((md) => md.league_id === leagueFilter);

  // Split by type
  const matches = filteredActivities.filter((a) => a.activity_type === "match");
  const runs = filteredActivities.filter((a) => a.activity_type === "run");

  // All match details (linked + standalone)
  const allMatchDetails: MatchDetailsWithLeague[] = [
    ...matches.filter((m) => m.match_details).map((m) => m.match_details!),
    ...filteredStandalone,
  ];

  // Stats
  const matchCount = allMatchDetails.length;
  const format7 = allMatchDetails.filter((m) => m.league?.format === "7v7").length;
  const format11 = allMatchDetails.filter((m) => m.league?.format === "11v11").length;

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

  return (
    <div className="min-h-screen px-4 py-5 sm:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Your season</h1>
          <p className="text-sm text-gray-500">{dateRange}</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          {stravaConnected ? (
            <SyncButton />
          ) : (
            <a
              href="/api/strava/auth"
              className="text-sm bg-orange-500 text-white px-3 py-2 rounded-lg
                         hover:bg-orange-600 transition"
            >
              Connect Strava
            </a>
          )}
          <Link
            href="/log/new"
            className="text-sm bg-blue-600 text-white px-3 py-2 rounded-lg
                       hover:bg-blue-700 transition"
          >
            Log match
          </Link>
          <SignOutButton />
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-6">
        <RangePicker />
        <LeagueFilter leagues={leagues} />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6">
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
          <Sparkline data={sparklineData} />
        </div>
      )}

      {/* Recent matches — merge linked + standalone, sorted by date */}
      {(() => {
        const merged = [
          ...matches.map((a) => ({
            type: "linked" as const,
            activity: a,
            date: new Date(a.started_at).getTime(),
          })),
          ...filteredStandalone.map((md) => ({
            type: "standalone" as const,
            md,
            date: new Date(md.match_date).getTime(),
          })),
        ].sort((a, b) => b.date - a.date);

        return (
          <div className="mb-8">
            <h2 className="text-lg font-bold mb-3">Recent matches</h2>
            {merged.length === 0 ? (
              <p className="text-sm text-gray-500">No matches yet. Sync from Strava or log one manually.</p>
            ) : (
              <div className="space-y-3">
                {merged.map((item) => {
                  if (item.type === "linked") {
                    return <MatchCard key={item.activity.id} activity={item.activity} />;
                  }
                  const md = item.md;
                  return (
                    <div key={md.id} className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-100 dark:border-gray-800">
                      <div className="flex items-center gap-2 mb-1">
                        {md.league && (
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {md.league.name}
                          </span>
                        )}
                        <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 px-2 py-0.5 rounded">
                          {md.league?.format}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mb-3">
                        {new Date(md.match_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        {md.positions && ` \u00b7 ${md.positions.join(" / ")}`}
                        {md.result && ` \u00b7 ${md.result}`}
                      </p>
                      <div className="flex items-center gap-3 mb-3">
                        {md.rating && <span className="text-2xl font-bold">{md.rating}/10</span>}
                        <span className="text-sm text-gray-500">
                          {md.goals} goal{md.goals !== 1 ? "s" : ""} {"\u00b7"} {md.assists} assist{md.assists !== 1 ? "s" : ""}
                        </span>
                      </div>
                      {md.notes && <p className="text-sm text-gray-500 italic">{md.notes}</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* Recent runs */}
      <div className="mb-8">
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

      {/* Insights */}
      {(() => {
        const formatInsight = computeFormatInsight(allMatchDetails, matches);
        const leagueInsight = computeLeagueInsight(allMatchDetails);
        const recoveryInsight = computeRecoveryInsight(matches, runs, allMatchDetails);
        const fitnessInsight = computeFitnessInsight(matches);

        const hasInsights = formatInsight || leagueInsight || recoveryInsight || fitnessInsight;
        if (!hasInsights) return null;

        return (
          <div>
            <h2 className="text-lg font-bold mb-3">Insights</h2>
            <div className="space-y-3">
              {formatInsight && (
                <InsightCard title="Performance pattern">
                  You rate yourself <strong>{formatInsight.diff} points higher</strong> in {formatInsight.higherFormat} games ({formatInsight.higherAvg}) than {formatInsight.lowerFormat} ({formatInsight.lowerAvg}).
                  {(formatInsight.higherDist > 0 || formatInsight.lowerDist > 0) && (
                    <> You also run {formatInsight.higherDist} mi avg in {formatInsight.higherFormat} vs {formatInsight.lowerDist} mi in {formatInsight.lowerFormat}.</>
                  )}
                </InsightCard>
              )}

              {leagueInsight && (
                <InsightCard title="League breakdown">
                  <div className="space-y-2">
                    {leagueInsight.leagues.map((l) => (
                      <div key={l.name} className="flex items-center justify-between">
                        <div>
                          <span className="font-medium text-gray-700 dark:text-gray-300">{l.name}</span>
                          <span className="text-xs text-gray-400 ml-1">{l.format}</span>
                        </div>
                        <div className="flex gap-3 text-xs">
                          <span>{l.matches} matches</span>
                          <span>{l.avgRating} avg</span>
                          <span>{l.goals}G / {l.assists}A</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </InsightCard>
              )}

              {recoveryInsight && (
                <InsightCard title="Recovery flag">
                  Your <strong>{recoveryInsight.lowRatedCount} games after long runs</strong> (over {recoveryInsight.threshold} mi) averaged <strong>{recoveryInsight.avgRatingAfterLong}/10</strong> vs <strong>{recoveryInsight.avgRatingOtherwise}/10</strong> otherwise. Consider spacing runs and match days further apart.
                </InsightCard>
              )}

              {fitnessInsight && (
                <InsightCard title="Fitness trend">
                  Your avg heart rate has {fitnessInsight.hrChange < 0 ? "dropped" : "risen"} <strong>{Math.abs(fitnessInsight.hrChange)} bpm</strong> over this period
                  {Math.abs(fitnessInsight.distanceChange) < 0.3
                    ? " while distance stayed flat"
                    : ` while distance ${fitnessInsight.distanceChange > 0 ? "increased" : "decreased"} by ${Math.abs(fitnessInsight.distanceChange)} mi`
                  }.{" "}
                  {fitnessInsight.hrChange < 0
                    ? "Your fitness is improving."
                    : "Your effort level is increasing."}
                </InsightCard>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
