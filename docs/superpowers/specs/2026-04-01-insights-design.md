# v1.1 Insights — Design Spec

## Overview

Add an insights section below the match/run feeds on the dashboard. Four insight types computed server-side from existing data. Respects active range picker and league filter. Cards that can't be computed due to insufficient data are simply not rendered.

## Insights

### 1. Performance by Format

Compare avg rating in 7v7 vs 11v11.

- Shows: "You rate yourself X points higher in FORMAT (AVG) than FORMAT (AVG)"
- Also shows avg distance per format
- Requires: at least 2 matches in each format

### 2. Per-League Breakdown

Stats per league.

- Shows each league with: matches played, avg rating, total goals, total assists
- Sorted by avg rating descending
- Requires: at least 1 league with 2+ matches

### 3. Recovery Flag

Correlates pre-match runs with match performance.

- Looks for runs within 36 hours before a match (`run.started_at` between `match.started_at - 36h` and `match.started_at`)
- Compares avg rating after "long runs" vs after no run / short run
- Long run threshold: above personal avg run distance, or 5mi if fewer than 5 runs logged
- Shows: "Your N lowest-rated games came after runs over Xmi. Avg rating after long runs: X vs Y otherwise"
- Requires: at least 2 matches with a preceding run and 2 without

### 4. Fitness Trend

Track heart rate changes over time.

- Groups match activities by week, computes avg HR per week
- Compares first half of selected period to second half
- Shows: "Your avg HR has dropped/risen X bpm over the period while distance stayed flat/changed. Fitness is improving/declining."
- Requires: at least 4 matches with HR data across 2+ weeks

## Architecture

No new tables, API routes, or database queries. All insights are pure functions computed from the data already fetched on the dashboard (activities, match details with leagues, standalone matches).

### Files

| File | Change |
|------|--------|
| `src/lib/insights.ts` | New: pure functions computing each insight |
| `src/components/InsightCard.tsx` | New: card component for rendering an insight |
| `src/app/page.tsx` | Import insights, compute, render section below feeds |
| `src/lib/__tests__/insights.test.ts` | New: unit tests for insight computation |

## InsightCard component

Simple presentational card:
- `title`: string (e.g. "Performance pattern")
- `content`: string (the insight text)

Styled consistently with the existing stat cards — white bg, rounded, border.

## Insight function signatures

```ts
interface FormatInsight {
  type: "format";
  higherFormat: string;
  higherAvg: number;
  lowerFormat: string;
  lowerAvg: number;
  diff: number;
  higherDist: number;
  lowerDist: number;
}

interface LeagueInsight {
  type: "league";
  leagues: {
    name: string;
    format: string;
    matches: number;
    avgRating: number;
    goals: number;
    assists: number;
  }[];
}

interface RecoveryInsight {
  type: "recovery";
  avgRatingAfterLong: number;
  avgRatingOtherwise: number;
  threshold: number;
  lowRatedCount: number;
}

interface FitnessInsight {
  type: "fitness";
  firstHalfAvgHr: number;
  secondHalfAvgHr: number;
  hrChange: number;
  distanceChange: number;
}

type Insight = FormatInsight | LeagueInsight | RecoveryInsight | FitnessInsight;
```

Each function returns `Insight | null` — null means not enough data.

## What's NOT in this change

- Visualizations/charts for insights (text-based for now)
- Click-through to see the underlying data
- Configurable thresholds
