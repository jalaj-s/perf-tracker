# Leagues Table + Multi-Position — Design Spec

## Overview

Add a `leagues` table with metadata (name, format, location, organizer, co-ed) so match details reference a structured league instead of free text. Every match requires a league. Format moves from match_details to the league. Also change `position` from single text to an array for matches where you play multiple positions.

## Schema

### New `leagues` table

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | `gen_random_uuid()` |
| user_id | uuid (FK → auth.users) | cascade delete, not null |
| name | text, not null | "Friday Night League" |
| format | text, not null | check `('7v7', '11v11')` |
| location | text | "Framingham Sports Center" |
| organizer | text | "Volo", "city rec", etc. |
| is_coed | boolean | default false |
| created_at | timestamptz | default `now()` |

- Unique constraint on `(user_id, name)` — no duplicate league names per user.
- RLS: `auth.uid() = user_id` for all operations.
- Index: `(user_id)` — main lookup query.

### Changes to `match_details`

- **Remove** `league` (text) column
- **Remove** `format` (text) column
- **Add** `league_id` uuid, not null, FK → `leagues(id)` on delete restrict (don't let users delete a league that has matches)
- **Change** `position` from `text` to `text[]` (Postgres text array)

### Migration from existing data

Run in order:

1. Create the `leagues` table.
2. For each unique `(league, format)` pair in existing `match_details`, insert a row into `leagues` (using the same `user_id` from the match detail).
3. Add `league_id` column to `match_details` (nullable initially).
4. Update each `match_details` row to set `league_id` by matching on `league` text + `format`.
5. Convert `position` from `text` to `text[]` — wrap existing values in an array (`ARRAY[position]`), null stays null.
6. Alter `league_id` to not null.
7. Drop `league` and `format` columns from `match_details`.
8. Add foreign key constraint on `league_id`.

This is captured in a migration SQL file. Since we run SQL manually in Supabase dashboard, the migration is a single file with all steps.

## API

### `GET /api/leagues`

Returns all leagues for the authenticated user, ordered by name.

### Existing `POST /api/activities` changes

- Accepts `league_id` (uuid) instead of `league` (text) + `format` (text).
- Validates that the league exists and belongs to the user.
- `position` accepts `string[]` instead of `string`.

### League creation (inline)

No separate route needed — the match form creates leagues via a new `POST /api/leagues` route:

**`POST /api/leagues`**
- Body: `{ name, format, location?, organizer?, is_coed? }`
- Returns the created league.
- Validates name is not empty, format is valid.

## Match Form Changes

### League picker (replaces old league dropdown + format toggle)

- Dropdown lists user's leagues, each showing: name + format tag (e.g. "Friday Night League · 7v7")
- Selecting a league removes the format toggle — format is read-only, shown as a tag
- If no leagues exist, show the new league form expanded by default

### "New league" inline form

Below the dropdown, a "+ New league" button. Clicking expands:

- **Name** — text input (required)
- **Format** — 7v7 / 11v11 toggle (required)
- **Location** — text input (optional)
- **Organizer** — text input (optional)
- **Co-ed** — checkbox (default unchecked)
- **Save** / **Cancel** buttons

After save: new league is created via `POST /api/leagues`, added to the dropdown, and auto-selected. Inline form collapses.

### Position picker changes

- Currently single-select (tap one position, it highlights)
- Change to multi-select: tap to toggle on/off, multiple can be highlighted
- Visual: selected positions stay highlighted with the blue style, unselected are gray
- Form sends `positions: string[]` instead of `position: string`

## Types changes

### New `League` interface

```ts
export interface League {
  id: string;
  user_id: string;
  name: string;
  format: "7v7" | "11v11";
  location: string | null;
  organizer: string | null;
  is_coed: boolean;
  created_at: string;
}
```

### Updated `MatchDetails` interface

```ts
export interface MatchDetails {
  id: string;
  activity_id: string | null;
  user_id: string;
  league_id: string;          // was: league: string | null
  // format removed — comes from league
  result: string | null;
  positions: string[] | null;  // was: position: string | null
  goals: number;
  assists: number;
  rating: number | null;
  notes: string | null;
  match_date: string;
  created_at: string;
}
```

### Updated `ActivityWithMatch`

When fetching activities with match details, the league is joined:

```ts
export interface MatchDetailsWithLeague extends MatchDetails {
  league: League;
}

export interface ActivityWithMatch extends Activity {
  match_details: MatchDetailsWithLeague | null;
}
```

## Dashboard changes

- **Stat cards**: "Matches played" detail still shows format breakdown (e.g. "6x 7v7 · 2x 11v11"), derived by joining through the league.
- **MatchCard**: shows `league.name` instead of the old `league` text. Format tag comes from `league.format`.
- **Standalone match cards** in the dashboard: same change.
- **Position display**: show all positions joined with " / " (e.g. "CM / CAM").

## File changes summary

| File | Change |
|------|--------|
| `supabase/migration-leagues.sql` | New file: create leagues table, migrate data, alter match_details |
| `src/lib/types.ts` | Add `League`, update `MatchDetails`, update `ActivityWithMatch` |
| `src/app/api/leagues/route.ts` | New file: GET + POST leagues |
| `src/app/api/activities/route.ts` | Accept `league_id` + `positions[]` instead of `league` + `format` + `position` |
| `src/components/MatchForm.tsx` | League picker with inline create, multi-select positions |
| `src/components/MatchCard.tsx` | Show league name + format from joined league, multiple positions |
| `src/app/page.tsx` | Update queries to join league, update format breakdown stat |
| `src/app/log/[activityId]/page.tsx` | Pass leagues to MatchForm |
| `src/app/log/new/page.tsx` | Pass leagues to MatchForm |

## What's NOT in this change

- League edit/delete UI (can add later in a settings page)
- Per-league stats breakdown on the dashboard (v1.1 insights feature)
- League-based filtering on activity history (not built yet)
