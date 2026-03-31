# Soccer Performance Tracker — Design Spec

## Overview

A personal soccer performance tracker that syncs running and soccer activities from Strava/Garmin, lets you log match details (goals, assists, rating, etc.), and displays stats on a dashboard. Built to work for one user now, extensible to friends/teammates later.

## Stack

- **Next.js 14** — App Router for pages, API routes for backend logic
- **Supabase** — Postgres, Auth (magic link), Row Level Security
- **Strava API** — OAuth2, activity sync
- **Tailwind CSS** — styling
- **Vercel** — hosting (free tier)

No additional services. No Redis, no queues, no background workers.

## Auth

### MVP approach

Supabase Auth is wired in from day one so all code is multi-user ready. RLS policies use `auth.uid()` on every table.

- **Minimal magic link login page**: one email input, one button. Sends a Supabase magic link. This is required for RLS to function — without a real Supabase session, queries against RLS-protected tables fail.
- **Post-login**: dashboard with "Connect Strava" button if no tokens exist for the current user.
- **Session management**: `@supabase/ssr` handles session cookies. Next.js middleware refreshes the session on each request and redirects unauthenticated users to login.
- **No user management UI, no signup flow, no profile page.** You create your account by entering your email on the login page. When friends join later, they do the same — zero backend changes needed.

### Strava connect (secondary)

- "Connect Strava" button hits `/api/strava/auth`, which redirects to Strava OAuth.
- Strava redirects back to `/api/strava/callback` with an authorization code.
- Callback exchanges the code for tokens and stores them in `strava_tokens` against `auth.uid()` from the Supabase session.
- No dummy users, no raw cookies — the user must be authenticated via Supabase before connecting Strava.

## Database Schema

Three tables, all with RLS enabled and scoped to `auth.uid()`.

### `activities`

Stores every synced Strava activity (runs + soccer only).

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | `gen_random_uuid()` |
| user_id | uuid (FK → auth.users) | cascade delete |
| strava_id | bigint | unique per user (composite unique on `user_id, strava_id`) |
| activity_type | text | `'match'` or `'run'` |
| name | text | from Strava or user-entered |
| started_at | timestamptz | when it started |
| distance_miles | numeric(5,2) | total distance |
| duration_minutes | numeric(6,1) | total duration |
| avg_pace | text | e.g. `8'12"/mi` |
| avg_heart_rate | integer | bpm |
| max_heart_rate | integer | |
| calories | integer | |
| elevation_gain_ft | numeric(6,1) | |
| created_at | timestamptz | default `now()` |
| updated_at | timestamptz | default `now()` |

### `match_details`

Soccer-specific data you add after each game. One-to-one with an activity, or standalone.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | `gen_random_uuid()` |
| activity_id | uuid (FK → activities), nullable, unique | null for standalone matches |
| user_id | uuid (FK → auth.users) | needed for RLS on standalone matches |
| league | text | "Friday night league", etc. |
| format | text | `'7v7'` or `'11v11'` |
| result | text | `'W 6-3'`, `'L 2-4'`, `'D 1-1'` |
| position | text | `'CM'`, `'RW'`, `'ST'`, etc. |
| goals | integer | default 0 |
| assists | integer | default 0 |
| rating | integer | check 1-10 |
| notes | text | free-form |
| match_date | timestamptz | fallback when no linked activity |
| created_at | timestamptz | default `now()` |

### `strava_tokens`

One row per user. Stores OAuth credentials for Strava sync.

| Column | Type | Notes |
|--------|------|-------|
| user_id | uuid (PK, FK → auth.users) | cascade delete |
| access_token | text | |
| refresh_token | text | |
| expires_at | bigint | Unix timestamp |
| strava_athlete_id | bigint | |
| updated_at | timestamptz | default `now()` |

### RLS policies

- `activities`: `auth.uid() = user_id` for all operations
- `match_details`: `auth.uid() = user_id` for all operations (direct check via `user_id` column, not a subquery)
- `strava_tokens`: `auth.uid() = user_id` for all operations

### Indexes

- `activities(user_id, activity_type, started_at desc)` — main feed query
- `match_details(user_id, format, position)` — stats breakdowns

## Strava Integration

### OAuth flow

1. User clicks "Connect Strava" → `GET /api/strava/auth`
2. Redirects to `https://www.strava.com/oauth/authorize` with `scope=activity:read_all`
3. Strava redirects to `GET /api/strava/callback?code=...`
4. Callback exchanges code for tokens via `POST https://www.strava.com/oauth/token`
5. Tokens stored in `strava_tokens` against `auth.uid()`
6. Redirect to dashboard

### Token refresh

- Before any Strava API call, check `expires_at` against current time (with 5 min buffer)
- If expired, refresh via `POST https://www.strava.com/oauth/token` with `grant_type=refresh_token`
- Update stored tokens

### Activity sync

- Triggered manually via "Sync now" button on dashboard
- `POST /api/strava/sync` (authenticated via Supabase session)
- Fetches activities from Strava API (`GET /api/v3/athlete/activities`)
- Uses `after` param set to the most recent `started_at` in our DB to only fetch new activities
- Filters to Run + Soccer only:
  - `type === "Run"` or `sport_type === "Run"`
  - `sport_type === "Soccer"` or `type === "Soccer"`
  - Name contains "soccer" or "football" (case-insensitive)
- Maps Strava units (meters, seconds) to display units (miles, minutes, pace string)
- Upserts by `strava_id` to prevent duplicates
- Returns count of synced activities

### Error handling

- **Strava API down / network error**: sync fails gracefully, error toast shown ("Sync failed — try again in a minute")
- **Token refresh fails (401 from Strava)**: clear stored tokens, show "Reconnect Strava" button on dashboard. User re-authorizes via the normal OAuth flow.
- **Strava access revoked**: same as token refresh failure — 401 triggers token cleanup and reconnect prompt.

### No webhooks in v1

Manual sync is sufficient for personal use. Strava webhooks can be added later if needed.

## Match Logging

Two modes:

### Linked (default)

- From the dashboard, soccer activities without match details show a "Log details" button
- Clicking opens the match form pre-populated with Strava data (date, name, distance, HR, duration)
- User fills in: league, format (7v7/11v11), position, goals, assists, rating (1-10), result, notes
- Saves to `match_details` with `activity_id` set

### Standalone

- "Log match" button on dashboard for games without a Strava activity
- Same form but no Strava data section
- User must enter `match_date` manually
- `activity_id` is null, `user_id` set from session
- Route: `/log/new`

### Form UI

- Format: toggle buttons (7v7 / 11v11)
- League: dropdown (configurable list: "Friday night league", "Sunday competitive", "Tuesday night league", "Pickup", "Other")
- Position: grid of buttons (GK, CB, LB, RB, CDM, CM, CAM, LM, RM, LW, RW, ST)
- Goals/assists: +/- counter buttons
- Rating: 1-10 dot selector (filled dots up to selected value)
- Result: text input ("W 6-3", "L 2-4", "D 1-1")
- Notes: textarea

## Dashboard

### Layout (stats-first)

**Header area:**
- "Your season" title with date range (rolling 4 weeks)
- "Sync now" button — shows loading spinner during sync, toast notification on completion ("Synced 3 new activities" or "Already up to date")

**Stat cards row (top):**

| Card | Primary | Secondary |
|------|---------|-----------|
| Matches played | Count | Breakdown by format (e.g. "6x 7v7, 2x 11v11") |
| Goals / assists | Totals | Per-match rate (e.g. "0.63 G per match") |
| Avg rating | Number | Best rating with date |
| Avg distance | Miles | Separate avg for runs vs matches |

**Rating trend:**
- Simple sparkline chart below the stat cards
- X-axis: dates, Y-axis: rating values
- SVG-based (custom component, no charting library — it's one sparkline, recharts is overkill)

**Recent matches section:**
- Cards showing: league tag, format tag, date, position, result, rating
- Strava data: distance, avg HR, pace
- Notes excerpt
- "Log details" button on unlogged soccer activities

**Recent runs section:**
- Simpler cards: name, date, location, distance, pace, avg HR

## File Structure

```
src/
  app/
    layout.tsx              # Root layout with Supabase session provider
    page.tsx                # Dashboard
    login/
      page.tsx              # Magic link login
    log/
      [activityId]/
        page.tsx            # Log match details (linked)
      new/
        page.tsx            # Log match details (standalone)
    api/
      strava/
        auth/route.ts       # Redirect to Strava OAuth
        callback/route.ts   # Handle OAuth callback
        sync/route.ts       # Pull activities from Strava
      activities/
        route.ts            # CRUD for activities + match details
    globals.css
  lib/
    supabase/
      client.ts             # Browser Supabase client
      server.ts             # Server Supabase client (SSR)
      middleware.ts          # Session refresh middleware helper
    strava.ts               # Strava API helpers (token refresh, fetch, map)
    types.ts                # TypeScript types
  components/
    StatCard.tsx            # Single stat card
    MatchCard.tsx           # Match activity card
    RunCard.tsx             # Run activity card
    MatchForm.tsx           # Match logging form
    RatingDots.tsx          # 1-10 dot rating selector
    Sparkline.tsx           # SVG sparkline for rating trend
    SyncButton.tsx          # Sync now button with loading/toast
  middleware.ts             # Next.js middleware (session refresh + auth redirect)
```

## What's NOT in v1

- **Insights/trends** (performance patterns, recovery flags, fitness trends) — deferred to v1.1 once there's real data to query
- **Activity history page** with filtering/search
- **Strava webhooks** (manual sync is fine)
- **Social/sharing features**
- **User management UI** (signup, profile, settings)

## v1.1 (planned)

- **Insights section** on dashboard:
  - Performance by format (7v7 vs 11v11 rating comparison)
  - Recovery flag (low ratings correlated with long runs the previous day)
  - Fitness trend (avg HR over time at similar distances)
- Activity history page with filtering by type, date range, league
