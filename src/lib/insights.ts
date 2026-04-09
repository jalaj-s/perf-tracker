import { ActivityWithMatch, MatchDetailsWithLeague } from "./types";

// --- Types ---

export interface FormatInsight {
  type: "format";
  higherFormat: string;
  higherAvg: number;
  lowerFormat: string;
  lowerAvg: number;
  diff: number;
  higherDist: number;
  lowerDist: number;
}

export interface LeagueStats {
  name: string;
  format: string;
  matches: number;
  avgRating: number;
  goals: number;
  assists: number;
}

export interface LeagueInsight {
  type: "league";
  leagues: LeagueStats[];
}

export interface RecoveryInsight {
  type: "recovery";
  avgRatingAfterLong: number;
  avgRatingOtherwise: number;
  threshold: number;
  lowRatedCount: number;
}

export interface FitnessInsight {
  type: "fitness";
  firstHalfAvgHr: number;
  secondHalfAvgHr: number;
  hrChange: number;
  distanceChange: number;
}

export interface PositionStats {
  position: string;
  matches: number;
  avgRating: number;
  goals: number;
  assists: number;
}

export interface PositionInsight {
  type: "position";
  positions: PositionStats[];
  bestPosition: string;
  bestRating: number;
}

export type Insight = FormatInsight | LeagueInsight | RecoveryInsight | FitnessInsight | PositionInsight;

// --- Helpers ---

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// --- Insight computations ---

export function computeFormatInsight(
  allMatchDetails: MatchDetailsWithLeague[],
  matchActivities: ActivityWithMatch[]
): FormatInsight | null {
  const rated7 = allMatchDetails.filter((m) => m.league?.format === "7v7" && m.rating);
  const rated11 = allMatchDetails.filter((m) => m.league?.format === "11v11" && m.rating);

  if (rated7.length < 2 || rated11.length < 2) return null;

  const avg7 = round1(avg(rated7.map((m) => m.rating!)));
  const avg11 = round1(avg(rated11.map((m) => m.rating!)));

  // Distances from linked match activities
  const dist7 = matchActivities
    .filter((a) => a.match_details?.league?.format === "7v7" && a.distance_miles)
    .map((a) => a.distance_miles!);
  const dist11 = matchActivities
    .filter((a) => a.match_details?.league?.format === "11v11" && a.distance_miles)
    .map((a) => a.distance_miles!);

  const avgDist7 = round1(avg(dist7));
  const avgDist11 = round1(avg(dist11));

  const [higherFormat, higherAvg, lowerFormat, lowerAvg, higherDist, lowerDist] =
    avg11 >= avg7
      ? ["11v11", avg11, "7v7", avg7, avgDist11, avgDist7]
      : ["7v7", avg7, "11v11", avg11, avgDist7, avgDist11];

  return {
    type: "format",
    higherFormat,
    higherAvg,
    lowerFormat,
    lowerAvg,
    diff: round1(higherAvg - lowerAvg),
    higherDist,
    lowerDist,
  };
}

export function computeLeagueInsight(
  allMatchDetails: MatchDetailsWithLeague[]
): LeagueInsight | null {
  const byLeague = new Map<string, { name: string; format: string; ratings: number[]; goals: number; assists: number }>();

  for (const md of allMatchDetails) {
    if (!md.league) continue;
    const key = md.league.id;
    if (!byLeague.has(key)) {
      byLeague.set(key, { name: md.league.name, format: md.league.format, ratings: [], goals: 0, assists: 0 });
    }
    const entry = byLeague.get(key)!;
    if (md.rating) entry.ratings.push(md.rating);
    entry.goals += md.goals;
    entry.assists += md.assists;
  }

  const leagues: LeagueStats[] = [];
  for (const entry of Array.from(byLeague.values())) {
    if (entry.ratings.length < 2) continue;
    leagues.push({
      name: entry.name,
      format: entry.format,
      matches: entry.ratings.length,
      avgRating: round1(avg(entry.ratings)),
      goals: entry.goals,
      assists: entry.assists,
    });
  }

  if (leagues.length === 0) return null;

  leagues.sort((a, b) => b.avgRating - a.avgRating);

  return { type: "league", leagues };
}

export function computeRecoveryInsight(
  matchActivities: ActivityWithMatch[],
  runActivities: ActivityWithMatch[],
  allMatchDetails: MatchDetailsWithLeague[]
): RecoveryInsight | null {
  // Determine threshold
  const runDistances = runActivities
    .filter((r) => r.distance_miles)
    .map((r) => r.distance_miles!);

  const threshold = runDistances.length >= 5
    ? round1(avg(runDistances))
    : 5;

  // For each match with a rating, find if there was a run within 36h before
  const ratedMatches = [
    ...matchActivities.filter((a) => a.match_details?.rating).map((a) => ({
      rating: a.match_details!.rating!,
      startedAt: new Date(a.started_at).getTime(),
    })),
    ...allMatchDetails.filter((md) => md.rating && !md.activity_id).map((md) => ({
      rating: md.rating!,
      startedAt: new Date(md.match_date).getTime(),
    })),
  ];

  const runs = runActivities
    .filter((r) => r.distance_miles)
    .map((r) => ({
      distance: r.distance_miles!,
      startedAt: new Date(r.started_at).getTime(),
    }));

  const afterLong: number[] = [];
  const otherwise: number[] = [];

  for (const match of ratedMatches) {
    const precedingRun = runs.find(
      (r) => r.startedAt < match.startedAt && r.startedAt >= match.startedAt - 36 * 60 * 60 * 1000
    );

    if (precedingRun && precedingRun.distance >= threshold) {
      afterLong.push(match.rating);
    } else {
      otherwise.push(match.rating);
    }
  }

  if (afterLong.length < 2 || otherwise.length < 2) return null;

  const avgAfterLong = round1(avg(afterLong));
  const avgOtherwise = round1(avg(otherwise));

  // Only show if there's a meaningful difference
  if (Math.abs(avgOtherwise - avgAfterLong) < 0.3) return null;

  return {
    type: "recovery",
    avgRatingAfterLong: avgAfterLong,
    avgRatingOtherwise: avgOtherwise,
    threshold,
    lowRatedCount: afterLong.length,
  };
}

export function computePositionInsight(
  allMatchDetails: MatchDetailsWithLeague[]
): PositionInsight | null {
  const byPosition = new Map<string, { ratings: number[]; goals: number; assists: number }>();

  for (const md of allMatchDetails) {
    if (!md.positions || md.positions.length === 0) continue;
    for (const pos of md.positions) {
      if (!byPosition.has(pos)) {
        byPosition.set(pos, { ratings: [], goals: 0, assists: 0 });
      }
      const entry = byPosition.get(pos)!;
      if (md.rating) entry.ratings.push(md.rating);
      entry.goals += md.goals;
      entry.assists += md.assists;
    }
  }

  const positions: PositionStats[] = [];
  for (const [position, entry] of Array.from(byPosition.entries())) {
    if (entry.ratings.length < 2) continue;
    positions.push({
      position,
      matches: entry.ratings.length,
      avgRating: round1(avg(entry.ratings)),
      goals: entry.goals,
      assists: entry.assists,
    });
  }

  if (positions.length < 2) return null;

  positions.sort((a, b) => b.avgRating - a.avgRating);

  return {
    type: "position",
    positions,
    bestPosition: positions[0].position,
    bestRating: positions[0].avgRating,
  };
}

export function computeFitnessInsight(
  matchActivities: ActivityWithMatch[]
): FitnessInsight | null {
  const withHr = matchActivities
    .filter((a) => a.avg_heart_rate && a.distance_miles)
    .sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime());

  if (withHr.length < 4) return null;

  // Check we have data across at least 2 weeks
  const firstDate = new Date(withHr[0].started_at).getTime();
  const lastDate = new Date(withHr[withHr.length - 1].started_at).getTime();
  if (lastDate - firstDate < 14 * 24 * 60 * 60 * 1000) return null;

  const mid = Math.floor(withHr.length / 2);
  const firstHalf = withHr.slice(0, mid);
  const secondHalf = withHr.slice(mid);

  const firstHalfAvgHr = round1(avg(firstHalf.map((a) => a.avg_heart_rate!)));
  const secondHalfAvgHr = round1(avg(secondHalf.map((a) => a.avg_heart_rate!)));
  const firstHalfAvgDist = round1(avg(firstHalf.map((a) => a.distance_miles!)));
  const secondHalfAvgDist = round1(avg(secondHalf.map((a) => a.distance_miles!)));

  return {
    type: "fitness",
    firstHalfAvgHr,
    secondHalfAvgHr,
    hrChange: round1(secondHalfAvgHr - firstHalfAvgHr),
    distanceChange: round1(secondHalfAvgDist - firstHalfAvgDist),
  };
}
