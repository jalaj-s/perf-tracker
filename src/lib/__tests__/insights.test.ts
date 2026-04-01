import { describe, it, expect } from "vitest";
import {
  computeFormatInsight,
  computeLeagueInsight,
  computeRecoveryInsight,
  computeFitnessInsight,
} from "../insights";
import { ActivityWithMatch, MatchDetailsWithLeague } from "../types";

// --- Helpers to build test data ---

const league7 = { id: "l1", user_id: "u1", name: "Friday", format: "7v7" as const, location: null, organizer: null, is_coed: false, created_at: "" };
const league11 = { id: "l2", user_id: "u1", name: "Sunday", format: "11v11" as const, location: null, organizer: null, is_coed: false, created_at: "" };

function makeMatch(overrides: Partial<MatchDetailsWithLeague> & { league?: typeof league7 }): MatchDetailsWithLeague {
  return {
    id: Math.random().toString(),
    activity_id: null,
    user_id: "u1",
    league_id: "l1",
    result: null,
    positions: null,
    goals: 0,
    assists: 0,
    rating: null,
    notes: null,
    match_date: "2026-03-20T20:00:00Z",
    created_at: "",
    league: league7,
    ...overrides,
  };
}

function makeActivity(type: "match" | "run", startedAt: string, overrides: Partial<ActivityWithMatch> = {}): ActivityWithMatch {
  return {
    id: Math.random().toString(),
    user_id: "u1",
    strava_id: null,
    activity_type: type,
    name: null,
    started_at: startedAt,
    distance_miles: null,
    duration_minutes: null,
    avg_pace: null,
    avg_heart_rate: null,
    max_heart_rate: null,
    calories: null,
    elevation_gain_ft: null,
    created_at: "",
    updated_at: "",
    match_details: null,
    ...overrides,
  };
}

describe("computeFormatInsight", () => {
  it("returns null with fewer than 2 matches in a format", () => {
    const matches = [
      makeMatch({ rating: 7, league: league7 }),
      makeMatch({ rating: 8, league: league7 }),
      makeMatch({ rating: 9, league: league11 }),
    ];
    expect(computeFormatInsight(matches, [])).toBeNull();
  });

  it("computes format comparison correctly", () => {
    const matches = [
      makeMatch({ rating: 6, league: league7 }),
      makeMatch({ rating: 7, league: league7 }),
      makeMatch({ rating: 8, league: league11 }),
      makeMatch({ rating: 9, league: league11 }),
    ];
    const result = computeFormatInsight(matches, []);
    expect(result).not.toBeNull();
    expect(result!.higherFormat).toBe("11v11");
    expect(result!.higherAvg).toBe(8.5);
    expect(result!.lowerAvg).toBe(6.5);
    expect(result!.diff).toBe(2);
  });
});

describe("computeLeagueInsight", () => {
  it("returns null when no league has 2+ rated matches", () => {
    const matches = [makeMatch({ rating: 7, league: league7 })];
    expect(computeLeagueInsight(matches)).toBeNull();
  });

  it("returns league breakdown sorted by avg rating", () => {
    const matches = [
      makeMatch({ rating: 6, league: league7 }),
      makeMatch({ rating: 7, league: league7, goals: 1 }),
      makeMatch({ rating: 8, league: league11 }),
      makeMatch({ rating: 9, league: league11, goals: 2, assists: 1 }),
    ];
    const result = computeLeagueInsight(matches);
    expect(result).not.toBeNull();
    expect(result!.leagues).toHaveLength(2);
    expect(result!.leagues[0].name).toBe("Sunday"); // higher avg
    expect(result!.leagues[0].avgRating).toBe(8.5);
    expect(result!.leagues[1].name).toBe("Friday");
    expect(result!.leagues[1].goals).toBe(1);
  });
});

describe("computeRecoveryInsight", () => {
  it("returns null with insufficient data", () => {
    expect(computeRecoveryInsight([], [], [])).toBeNull();
  });

  it("detects lower ratings after long runs", () => {
    // Match at 8pm, run at 8am same day (12h before) with 6mi
    const run = makeActivity("run", "2026-03-20T08:00:00Z", { distance_miles: 6 });
    const matchAfterRun = makeActivity("match", "2026-03-20T20:00:00Z", {
      match_details: makeMatch({ rating: 5, match_date: "2026-03-20T20:00:00Z" }),
    });
    const matchAfterRun2 = makeActivity("match", "2026-03-21T20:00:00Z", {
      match_details: makeMatch({ rating: 5, match_date: "2026-03-21T20:00:00Z" }),
    });
    const run2 = makeActivity("run", "2026-03-21T08:00:00Z", { distance_miles: 7 });

    // Matches without preceding long run
    const cleanMatch1 = makeActivity("match", "2026-03-25T20:00:00Z", {
      match_details: makeMatch({ rating: 8, match_date: "2026-03-25T20:00:00Z" }),
    });
    const cleanMatch2 = makeActivity("match", "2026-03-26T20:00:00Z", {
      match_details: makeMatch({ rating: 8, match_date: "2026-03-26T20:00:00Z" }),
    });

    const matchActivities = [matchAfterRun, matchAfterRun2, cleanMatch1, cleanMatch2];
    const runActivities = [run, run2];

    const result = computeRecoveryInsight(matchActivities, runActivities, []);
    expect(result).not.toBeNull();
    expect(result!.avgRatingAfterLong).toBe(5);
    expect(result!.avgRatingOtherwise).toBe(8);
  });
});

describe("computeFitnessInsight", () => {
  it("returns null with fewer than 4 matches", () => {
    const activities = [
      makeActivity("match", "2026-03-01T20:00:00Z", { avg_heart_rate: 160, distance_miles: 5 }),
      makeActivity("match", "2026-03-05T20:00:00Z", { avg_heart_rate: 158, distance_miles: 5 }),
    ];
    expect(computeFitnessInsight(activities)).toBeNull();
  });

  it("detects improving fitness (HR dropping)", () => {
    const activities = [
      makeActivity("match", "2026-03-01T20:00:00Z", { avg_heart_rate: 165, distance_miles: 5 }),
      makeActivity("match", "2026-03-07T20:00:00Z", { avg_heart_rate: 163, distance_miles: 5 }),
      makeActivity("match", "2026-03-14T20:00:00Z", { avg_heart_rate: 158, distance_miles: 5 }),
      makeActivity("match", "2026-03-21T20:00:00Z", { avg_heart_rate: 156, distance_miles: 5 }),
    ];
    const result = computeFitnessInsight(activities);
    expect(result).not.toBeNull();
    expect(result!.hrChange).toBeLessThan(0); // HR decreased
    expect(result!.distanceChange).toBe(0); // distance flat
  });
});
