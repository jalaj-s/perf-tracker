import { describe, it, expect } from "vitest";
import {
  metersToMiles,
  metersToFeet,
  calcPace,
  isRelevantActivity,
  mapStravaActivity,
} from "../strava";
import { StravaActivity } from "../types";

describe("metersToMiles", () => {
  it("converts meters to miles rounded to 2 decimal places", () => {
    expect(metersToMiles(1609.34)).toBe(1);
    expect(metersToMiles(5000)).toBe(3.11);
    expect(metersToMiles(0)).toBe(0);
  });
});

describe("metersToFeet", () => {
  it("converts meters to feet rounded to 1 decimal place", () => {
    expect(metersToFeet(100)).toBe(328.1);
    expect(metersToFeet(0)).toBe(0);
  });
});

describe("calcPace", () => {
  it("calculates pace string from distance and time", () => {
    expect(calcPace(1609.34, 480)).toBe("8'00\"/mi");
  });

  it("returns null when distance is 0", () => {
    expect(calcPace(0, 480)).toBeNull();
  });

  it("returns null when time is 0", () => {
    expect(calcPace(1609.34, 0)).toBeNull();
  });

  it("handles 60-second rollover", () => {
    // Edge case: when fractional seconds round up to 60, should roll over
    const result = calcPace(1609.34, 480);
    expect(result).not.toContain("'60\"");
  });
});

describe("isRelevantActivity", () => {
  const baseActivity: StravaActivity = {
    id: 1,
    name: "Morning run",
    type: "Run",
    sport_type: "Run",
    start_date: "2026-03-28T08:00:00Z",
    distance: 5000,
    moving_time: 1800,
    elapsed_time: 1900,
    total_elevation_gain: 50,
  };

  it("accepts Run type", () => {
    expect(isRelevantActivity(baseActivity)).toBe(true);
  });

  it("accepts Soccer sport_type", () => {
    expect(isRelevantActivity({ ...baseActivity, type: "Workout", sport_type: "Soccer" })).toBe(true);
  });

  it("accepts Soccer type", () => {
    expect(isRelevantActivity({ ...baseActivity, type: "Soccer", sport_type: "Soccer" })).toBe(true);
  });

  it("accepts activity with soccer in name", () => {
    expect(isRelevantActivity({ ...baseActivity, type: "Workout", sport_type: "Workout", name: "Friday Soccer" })).toBe(true);
  });

  it("accepts activity with football in name", () => {
    expect(isRelevantActivity({ ...baseActivity, type: "Workout", sport_type: "Workout", name: "Sunday Football" })).toBe(true);
  });

  it("rejects Ride type", () => {
    expect(isRelevantActivity({ ...baseActivity, type: "Ride", sport_type: "Ride", name: "Morning ride" })).toBe(false);
  });
});

describe("mapStravaActivity", () => {
  const soccerActivity: StravaActivity = {
    id: 123,
    name: "Friday night soccer",
    type: "Soccer",
    sport_type: "Soccer",
    start_date: "2026-03-28T20:00:00Z",
    distance: 8690,
    moving_time: 3600,
    elapsed_time: 5400,
    average_heartrate: 162,
    max_heartrate: 185,
    calories: 650,
    total_elevation_gain: 30,
  };

  it("maps a soccer activity correctly", () => {
    const result = mapStravaActivity(soccerActivity, "user-123");
    expect(result.user_id).toBe("user-123");
    expect(result.strava_id).toBe(123);
    expect(result.activity_type).toBe("match");
    expect(result.name).toBe("Friday night soccer");
    expect(result.distance_miles).toBe(5.4);
    expect(result.avg_heart_rate).toBe(162);
    expect(result.max_heart_rate).toBe(185);
    expect(result.calories).toBe(650);
  });

  it("maps a run activity correctly", () => {
    const run: StravaActivity = {
      ...soccerActivity,
      id: 456,
      name: "Evening run",
      type: "Run",
      sport_type: "Run",
    };
    const result = mapStravaActivity(run, "user-123");
    expect(result.activity_type).toBe("run");
  });

  it("handles missing heartrate data", () => {
    const noHr = { ...soccerActivity, average_heartrate: undefined, max_heartrate: undefined };
    const result = mapStravaActivity(noHr, "user-123");
    expect(result.avg_heart_rate).toBeNull();
    expect(result.max_heart_rate).toBeNull();
  });
});
