# Soccer Performance Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a personal soccer performance tracker that syncs Strava activities, lets you log match details, and displays stats on a dashboard.

**Architecture:** Next.js 14 App Router with API routes for Strava integration and match CRUD. Supabase for Postgres, Auth (magic link), and RLS. All code is multi-user ready via `auth.uid()` scoping. No extra services.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, Supabase (`@supabase/supabase-js`, `@supabase/ssr`), Vitest (testing), Vercel (hosting)

**Spec:** `docs/superpowers/specs/2026-03-31-soccer-perf-tracker-design.md`

---

## File Map

### Created

| File | Responsibility |
|------|---------------|
| `src/lib/types.ts` | TypeScript types for activities, match details, Strava |
| `src/lib/supabase/client.ts` | Browser Supabase client |
| `src/lib/supabase/server.ts` | Server Supabase client (SSR, reads cookies) |
| `src/lib/supabase/middleware.ts` | Helper to refresh session in middleware |
| `src/lib/strava.ts` | Strava API helpers: token refresh, fetch, map, filter |
| `src/middleware.ts` | Next.js middleware: session refresh + auth redirect |
| `src/app/layout.tsx` | Root layout with global styles |
| `src/app/globals.css` | Tailwind imports |
| `src/app/login/page.tsx` | Magic link login page |
| `src/app/page.tsx` | Dashboard (stats + activity feed) |
| `src/app/log/[activityId]/page.tsx` | Log match details (linked to Strava activity) |
| `src/app/log/new/page.tsx` | Log match details (standalone) |
| `src/app/api/strava/auth/route.ts` | Redirect to Strava OAuth |
| `src/app/api/strava/callback/route.ts` | Handle Strava OAuth callback, store tokens |
| `src/app/api/strava/sync/route.ts` | Pull activities from Strava, upsert to DB |
| `src/app/api/activities/route.ts` | GET activities, POST match details |
| `src/components/StatCard.tsx` | Single stat card component |
| `src/components/MatchCard.tsx` | Match activity card |
| `src/components/RunCard.tsx` | Run activity card |
| `src/components/MatchForm.tsx` | Match logging form (shared by linked + standalone) |
| `src/components/RatingDots.tsx` | 1-10 dot rating selector |
| `src/components/Sparkline.tsx` | SVG sparkline for rating trend |
| `src/components/SyncButton.tsx` | Sync now button with loading/toast |
| `supabase/schema.sql` | Database schema (run manually in Supabase SQL editor) |
| `src/lib/__tests__/strava.test.ts` | Unit tests for Strava helpers |

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.mjs`, `next.config.ts`, `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx`
- Modify: `.env.local` (already exists, will update)

- [ ] **Step 1: Scaffold Next.js project**

```bash
cd /Users/jalaj.singh/Downloads/perf-tracker
npx create-next-app@14 . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-git
```

Use `--no-git` because we already have a git repo. If prompted to overwrite files, accept — we'll fix `.env.local` next.

- [ ] **Step 2: Restore .env.local if overwritten**

Verify `.env.local` still contains:

```env
STRAVA_CLIENT_ID=218535
STRAVA_CLIENT_SECRET=bb04f5c52bceb1f3884d786854b8f5f441f5dca4
NEXT_PUBLIC_STRAVA_CLIENT_ID=218535
STRAVA_REDIRECT_URI=http://localhost:3000/api/strava/callback

NEXT_PUBLIC_SUPABASE_URL=https://yourproject.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhb...
SUPABASE_SERVICE_ROLE_KEY=eyJhb...
```

Note: `NEXT_PUBLIC_STRAVA_CLIENT_ID` should match `STRAVA_CLIENT_ID` (both `218535`).

- [ ] **Step 3: Install Supabase dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr
```

- [ ] **Step 4: Install Vitest for testing**

```bash
npm install -D vitest @vitejs/plugin-react
```

Create `vitest.config.ts` at project root:

```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

- [ ] **Step 5: Update .gitignore**

Append to `.gitignore`:

```
# dependencies
node_modules/

# next
.next/
out/

# env
.env.local
.env

# misc
.DS_Store
*.tsbuildinfo
next-env.d.ts
```

- [ ] **Step 6: Verify the app starts**

```bash
npm run dev
```

Visit `http://localhost:3000` — should see the default Next.js page. Kill the dev server after verifying.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js 14 project with Tailwind and Supabase deps"
```

---

## Task 2: Database Schema

**Files:**
- Create: `supabase/schema.sql`

This SQL is run manually in the Supabase dashboard SQL editor. It is NOT auto-executed.

- [ ] **Step 1: Create schema file**

Create `supabase/schema.sql`:

```sql
-- ============================================
-- Soccer Performance Tracker — Supabase Schema
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================

-- Activities: synced from Strava (runs + soccer only)
create table activities (
  id              uuid default gen_random_uuid() primary key,
  user_id         uuid references auth.users(id) on delete cascade not null,
  strava_id       bigint,
  activity_type   text not null check (activity_type in ('match', 'run')),
  name            text,
  started_at      timestamptz not null,
  distance_miles  numeric(5,2),
  duration_minutes numeric(6,1),
  avg_pace        text,
  avg_heart_rate  integer,
  max_heart_rate  integer,
  calories        integer,
  elevation_gain_ft numeric(6,1),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),

  unique(user_id, strava_id)
);

-- Match details: soccer-specific data added after each game
create table match_details (
  id              uuid default gen_random_uuid() primary key,
  activity_id     uuid references activities(id) on delete cascade unique,
  user_id         uuid references auth.users(id) on delete cascade not null,
  league          text,
  format          text not null check (format in ('7v7', '11v11')),
  result          text,
  position        text,
  goals           integer default 0,
  assists         integer default 0,
  rating          integer check (rating between 1 and 10),
  notes           text,
  match_date      timestamptz not null,
  created_at      timestamptz default now()
);

-- Strava tokens: one row per user
create table strava_tokens (
  user_id           uuid references auth.users(id) on delete cascade primary key,
  access_token      text not null,
  refresh_token     text not null,
  expires_at        bigint not null,
  strava_athlete_id bigint,
  updated_at        timestamptz default now()
);

-- Indexes
create index idx_activities_user_type_date
  on activities(user_id, activity_type, started_at desc);

create index idx_match_details_user_format_position
  on match_details(user_id, format, position);

-- Row Level Security
alter table activities enable row level security;
alter table match_details enable row level security;
alter table strava_tokens enable row level security;

create policy "Users manage own activities"
  on activities for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own match details"
  on match_details for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own tokens"
  on strava_tokens for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

- [ ] **Step 2: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat: add Supabase schema for activities, match_details, strava_tokens"
```

---

## Task 3: TypeScript Types

**Files:**
- Create: `src/lib/types.ts`

- [ ] **Step 1: Create types file**

Create `src/lib/types.ts`:

```ts
export interface Activity {
  id: string;
  user_id: string;
  strava_id: number | null;
  activity_type: "match" | "run";
  name: string | null;
  started_at: string;
  distance_miles: number | null;
  duration_minutes: number | null;
  avg_pace: string | null;
  avg_heart_rate: number | null;
  max_heart_rate: number | null;
  calories: number | null;
  elevation_gain_ft: number | null;
  created_at: string;
  updated_at: string;
}

export interface MatchDetails {
  id: string;
  activity_id: string | null;
  user_id: string;
  league: string | null;
  format: "7v7" | "11v11";
  result: string | null;
  position: string | null;
  goals: number;
  assists: number;
  rating: number | null;
  notes: string | null;
  match_date: string;
  created_at: string;
}

export interface ActivityWithMatch extends Activity {
  match_details: MatchDetails | null;
}

export interface StravaTokens {
  user_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: number;
  strava_athlete_id: number | null;
  updated_at: string;
}

// What Strava's API returns for an activity
export interface StravaActivity {
  id: number;
  name: string;
  type: string;
  sport_type: string;
  start_date: string;
  distance: number; // meters
  moving_time: number; // seconds
  elapsed_time: number; // seconds
  average_heartrate?: number;
  max_heartrate?: number;
  calories?: number;
  total_elevation_gain: number; // meters
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add TypeScript types for activities, match details, Strava"
```

---

## Task 4: Supabase Client Setup

**Files:**
- Create: `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/middleware.ts`

- [ ] **Step 1: Create browser client**

Create `src/lib/supabase/client.ts`:

```ts
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 2: Create server client**

Create `src/lib/supabase/server.ts`:

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing sessions.
          }
        },
      },
    }
  );
}
```

- [ ] **Step 3: Create middleware helper**

Create `src/lib/supabase/middleware.ts`:

```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (
    !user &&
    !request.nextUrl.pathname.startsWith("/login") &&
    !request.nextUrl.pathname.startsWith("/api/strava/callback") &&
    !request.nextUrl.pathname.startsWith("/auth")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/supabase/
git commit -m "feat: add Supabase client setup (browser, server, middleware)"
```

---

## Task 5: Auth Middleware + Login Page

**Files:**
- Create: `src/middleware.ts`, `src/app/login/page.tsx`
- Modify: `src/app/layout.tsx`, `src/app/globals.css`

- [ ] **Step 1: Create Next.js middleware**

Create `src/middleware.ts`:

```ts
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

- [ ] **Step 2: Create login page**

Create `src/app/login/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
    setLoading(false);
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="max-w-sm w-full text-center">
          <h1 className="text-2xl font-bold mb-2">Check your email</h1>
          <p className="text-gray-500">
            We sent a magic link to <strong>{email}</strong>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="max-w-sm w-full">
        <h1 className="text-2xl font-bold mb-1">Perf Tracker</h1>
        <p className="text-gray-500 mb-6">Sign in with your email</p>

        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                       dark:bg-gray-900 dark:border-gray-700"
          />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium
                       hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading ? "Sending..." : "Send magic link"}
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create auth callback route**

Create `src/app/auth/callback/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(origin);
}
```

- [ ] **Step 4: Update root layout**

Replace `src/app/layout.tsx` with:

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Perf Tracker",
  description: "Soccer performance tracker",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100`}>
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add src/middleware.ts src/app/login/ src/app/auth/ src/app/layout.tsx
git commit -m "feat: add auth middleware, magic link login, and auth callback"
```

---

## Task 6: Strava Helpers (TDD)

**Files:**
- Create: `src/lib/strava.ts`, `src/lib/__tests__/strava.test.ts`

- [ ] **Step 1: Write failing tests for pure helper functions**

Create `src/lib/__tests__/strava.test.ts`:

```ts
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
    // 1 mile in 8 minutes = 480 seconds, 1609.34 meters
    expect(calcPace(1609.34, 480)).toBe("8'00\"/mi");
  });

  it("returns null when distance is 0", () => {
    expect(calcPace(0, 480)).toBeNull();
  });

  it("returns null when time is 0", () => {
    expect(calcPace(1609.34, 0)).toBeNull();
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/lib/__tests__/strava.test.ts
```

Expected: FAIL — module `../strava` does not export the functions.

- [ ] **Step 3: Implement Strava helpers**

Create `src/lib/strava.ts`:

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { StravaActivity } from "./types";

const STRAVA_API = "https://www.strava.com/api/v3";

// --- Pure helpers (exported for testing) ---

export function metersToMiles(m: number): number {
  return Math.round((m / 1609.34) * 100) / 100;
}

export function metersToFeet(m: number): number {
  return Math.round(m * 3.281 * 10) / 10;
}

export function calcPace(distMeters: number, timeSecs: number): string | null {
  if (!distMeters || !timeSecs) return null;
  const miles = distMeters / 1609.34;
  const totalMinsPerMile = timeSecs / 60 / miles;
  const mins = Math.floor(totalMinsPerMile);
  const secs = Math.round((totalMinsPerMile - mins) * 60);
  return `${mins}'${secs.toString().padStart(2, "0")}"/mi`;
}

export function isRelevantActivity(activity: StravaActivity): boolean {
  const { type, sport_type, name } = activity;
  const nameLower = (name || "").toLowerCase();

  if (type === "Run" || sport_type === "Run") return true;
  if (type === "Soccer" || sport_type === "Soccer") return true;
  if (nameLower.includes("soccer") || nameLower.includes("football")) return true;

  return false;
}

export function mapStravaActivity(
  stravaActivity: StravaActivity,
  userId: string
) {
  const isSoccer =
    stravaActivity.sport_type === "Soccer" ||
    stravaActivity.type === "Soccer" ||
    stravaActivity.name.toLowerCase().includes("soccer") ||
    stravaActivity.name.toLowerCase().includes("football");

  return {
    user_id: userId,
    strava_id: stravaActivity.id,
    activity_type: isSoccer ? ("match" as const) : ("run" as const),
    name: stravaActivity.name,
    started_at: stravaActivity.start_date,
    distance_miles: metersToMiles(stravaActivity.distance),
    duration_minutes: Math.round((stravaActivity.moving_time / 60) * 10) / 10,
    avg_pace: calcPace(stravaActivity.distance, stravaActivity.moving_time),
    avg_heart_rate: stravaActivity.average_heartrate
      ? Math.round(stravaActivity.average_heartrate)
      : null,
    max_heart_rate: stravaActivity.max_heartrate
      ? Math.round(stravaActivity.max_heartrate)
      : null,
    calories: stravaActivity.calories
      ? Math.round(stravaActivity.calories)
      : null,
    elevation_gain_ft: metersToFeet(stravaActivity.total_elevation_gain),
  };
}

// --- Server-side helpers (require Supabase + env) ---

function getServiceSupabase() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() { return []; },
        setAll() {},
      },
    }
  );
}

export async function getValidToken(userId: string): Promise<string> {
  const db = getServiceSupabase();

  const { data: tokens } = await db
    .from("strava_tokens")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!tokens) throw new Error("No Strava tokens found");

  // Token expired (with 5 min buffer)?
  if (tokens.expires_at < Date.now() / 1000 + 300) {
    const res = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token: tokens.refresh_token,
      }),
    });

    if (!res.ok) {
      if (res.status === 401) {
        // Token revoked — clear stored tokens
        await db.from("strava_tokens").delete().eq("user_id", userId);
        throw new Error("STRAVA_TOKEN_REVOKED");
      }
      throw new Error(`Strava token refresh failed: ${res.status}`);
    }

    const refreshed = await res.json();

    await db
      .from("strava_tokens")
      .update({
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token,
        expires_at: refreshed.expires_at,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    return refreshed.access_token;
  }

  return tokens.access_token;
}

export async function fetchStravaActivities(
  accessToken: string,
  after?: number
): Promise<StravaActivity[]> {
  const params = new URLSearchParams({ per_page: "30" });
  if (after) params.set("after", after.toString());

  const res = await fetch(`${STRAVA_API}/athlete/activities?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) throw new Error(`Strava API error: ${res.status}`);
  return res.json();
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/lib/__tests__/strava.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/strava.ts src/lib/__tests__/strava.test.ts
git commit -m "feat: add Strava helpers with unit tests (TDD)"
```

---

## Task 7: Strava OAuth Routes

**Files:**
- Create: `src/app/api/strava/auth/route.ts`, `src/app/api/strava/callback/route.ts`

- [ ] **Step 1: Create Strava auth redirect route**

Create `src/app/api/strava/auth/route.ts`:

```ts
import { NextResponse } from "next/server";

export async function GET() {
  const params = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID!,
    redirect_uri: process.env.STRAVA_REDIRECT_URI!,
    response_type: "code",
    scope: "activity:read_all",
    approval_prompt: "auto",
  });

  return NextResponse.redirect(
    `https://www.strava.com/oauth/authorize?${params}`
  );
}
```

- [ ] **Step 2: Create Strava callback route**

Create `src/app/api/strava/callback/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.json({ error: "No code provided" }, { status: 400 });
  }

  // Get the authenticated user from Supabase session
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    // Redirect to login if not authenticated
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Exchange authorization code for tokens
  const tokenRes = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
    }),
  });

  const tokenData = await tokenRes.json();

  if (!tokenRes.ok) {
    return NextResponse.json(
      { error: "Token exchange failed", details: tokenData },
      { status: 400 }
    );
  }

  // Use service role to bypass RLS for upserting tokens
  const serviceDb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() { return []; },
        setAll() {},
      },
    }
  );

  const { error } = await serviceDb.from("strava_tokens").upsert(
    {
      user_id: user.id,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: tokenData.expires_at,
      strava_athlete_id: tokenData.athlete.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) {
    return NextResponse.json(
      { error: "Failed to store tokens", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.redirect(new URL("/", req.url));
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/strava/auth/ src/app/api/strava/callback/
git commit -m "feat: add Strava OAuth auth and callback routes"
```

---

## Task 8: Strava Sync Route

**Files:**
- Create: `src/app/api/strava/sync/route.ts`

- [ ] **Step 1: Create sync route**

Create `src/app/api/strava/sync/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";
import {
  getValidToken,
  fetchStravaActivities,
  mapStravaActivity,
  isRelevantActivity,
} from "@/lib/strava";

export async function POST() {
  // Get authenticated user
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const serviceDb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() { return []; },
        setAll() {},
      },
    }
  );

  try {
    const accessToken = await getValidToken(user.id);

    // Find most recent synced activity to only fetch newer ones
    const { data: latest } = await serviceDb
      .from("activities")
      .select("started_at")
      .eq("user_id", user.id)
      .order("started_at", { ascending: false })
      .limit(1)
      .single();

    const after = latest
      ? Math.floor(new Date(latest.started_at).getTime() / 1000)
      : undefined;

    const stravaActivities = await fetchStravaActivities(accessToken, after);

    // Filter to runs + soccer only, then map to our format
    const mapped = stravaActivities
      .filter(isRelevantActivity)
      .map((a) => mapStravaActivity(a, user.id));

    if (mapped.length === 0) {
      return NextResponse.json({ synced: 0, message: "Already up to date" });
    }

    const { data, error } = await serviceDb
      .from("activities")
      .upsert(mapped, { onConflict: "user_id,strava_id" })
      .select();

    if (error) throw error;

    return NextResponse.json({ synced: data?.length || 0 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";

    if (message === "STRAVA_TOKEN_REVOKED") {
      return NextResponse.json(
        { error: "Strava access revoked. Please reconnect.", reconnect: true },
        { status: 401 }
      );
    }

    console.error("Sync error:", message);
    return NextResponse.json(
      { error: "Sync failed", details: message },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/strava/sync/
git commit -m "feat: add Strava activity sync route with error handling"
```

---

## Task 9: Activities API Route

**Files:**
- Create: `src/app/api/activities/route.ts`

- [ ] **Step 1: Create activities route**

Create `src/app/api/activities/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";

// GET: fetch activities with optional type filter
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const type = searchParams.get("type");

  let query = supabase
    .from("activities")
    .select("*, match_details(*)")
    .eq("user_id", user.id)
    .order("started_at", { ascending: false });

  if (type) {
    query = query.eq("activity_type", type);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Flatten match_details from array to single object or null
  const activities = (data || []).map((a) => ({
    ...a,
    match_details: Array.isArray(a.match_details)
      ? a.match_details[0] || null
      : a.match_details,
  }));

  return NextResponse.json(activities);
}

// POST: save or update match details
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json();

  const serviceDb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() { return []; },
        setAll() {},
      },
    }
  );

  // If linking to an activity, verify it belongs to this user
  if (body.activity_id) {
    const { data: activity } = await serviceDb
      .from("activities")
      .select("id, started_at")
      .eq("id", body.activity_id)
      .eq("user_id", user.id)
      .single();

    if (!activity) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    }

    // Copy started_at to match_date for linked matches
    body.match_date = body.match_date || activity.started_at;
  }

  const matchData = {
    activity_id: body.activity_id || null,
    user_id: user.id,
    format: body.format,
    league: body.league || null,
    position: body.position || null,
    goals: body.goals ?? 0,
    assists: body.assists ?? 0,
    rating: body.rating || null,
    result: body.result || null,
    notes: body.notes || null,
    match_date: body.match_date,
  };

  // Upsert by activity_id if linking, otherwise insert
  let query;
  if (body.activity_id) {
    query = serviceDb
      .from("match_details")
      .upsert(matchData, { onConflict: "activity_id" })
      .select()
      .single();
  } else {
    query = serviceDb
      .from("match_details")
      .insert(matchData)
      .select()
      .single();
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/activities/
git commit -m "feat: add activities API route (GET activities, POST match details)"
```

---

## Task 10: UI Components

**Files:**
- Create: `src/components/StatCard.tsx`, `src/components/RatingDots.tsx`, `src/components/Sparkline.tsx`, `src/components/RunCard.tsx`, `src/components/MatchCard.tsx`, `src/components/SyncButton.tsx`

- [ ] **Step 1: Create StatCard component**

Create `src/components/StatCard.tsx`:

```tsx
interface StatCardProps {
  label: string;
  value: string | number;
  detail?: string;
}

export default function StatCard({ label, value, detail }: StatCardProps) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-100 dark:border-gray-800">
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      {detail && <p className="text-sm text-gray-400 mt-1">{detail}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Create RatingDots component**

Create `src/components/RatingDots.tsx`:

```tsx
"use client";

interface RatingDotsProps {
  value: number;
  onChange?: (value: number) => void;
  readonly?: boolean;
}

export default function RatingDots({ value, onChange, readonly }: RatingDotsProps) {
  return (
    <div className="flex gap-1.5">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
        <button
          key={n}
          type="button"
          disabled={readonly}
          onClick={() => onChange?.(n)}
          className={`w-8 h-8 rounded-full text-xs font-medium transition
            ${n <= value
              ? "bg-green-500 text-white"
              : "bg-gray-100 text-gray-400 dark:bg-gray-800"
            }
            ${readonly ? "cursor-default" : "cursor-pointer hover:scale-110"}
          `}
        >
          {n}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Create Sparkline component**

Create `src/components/Sparkline.tsx`:

```tsx
interface SparklineProps {
  data: { date: string; value: number }[];
  height?: number;
  width?: number;
}

export default function Sparkline({ data, height = 60, width = 300 }: SparklineProps) {
  if (data.length < 2) return null;

  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const padding = 4;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1)) * chartWidth;
    const y = padding + chartHeight - ((d.value - min) / range) * chartHeight;
    return `${x},${y}`;
  });

  const polyline = points.join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ maxWidth: width }}>
      <polyline
        points={polyline}
        fill="none"
        stroke="#22c55e"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Dots on each data point */}
      {data.map((d, i) => {
        const x = padding + (i / (data.length - 1)) * chartWidth;
        const y = padding + chartHeight - ((d.value - min) / range) * chartHeight;
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r="3"
            fill="#22c55e"
          />
        );
      })}
    </svg>
  );
}
```

- [ ] **Step 4: Create RunCard component**

Create `src/components/RunCard.tsx`:

```tsx
import { Activity } from "@/lib/types";

interface RunCardProps {
  activity: Activity;
}

export default function RunCard({ activity }: RunCardProps) {
  const date = new Date(activity.started_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <div className="flex items-center gap-4 bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-100 dark:border-gray-800">
      <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-950 flex items-center justify-center text-blue-600 font-bold text-sm">
        R
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{activity.name || "Run"}</p>
        <p className="text-sm text-gray-500">{date}</p>
      </div>
      <div className="flex gap-4 text-sm text-gray-500">
        {activity.distance_miles && (
          <span>{activity.distance_miles} mi</span>
        )}
        {activity.avg_pace && <span>{activity.avg_pace}</span>}
        {activity.avg_heart_rate && <span>{activity.avg_heart_rate} bpm</span>}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create MatchCard component**

Create `src/components/MatchCard.tsx`:

```tsx
import { ActivityWithMatch } from "@/lib/types";
import Link from "next/link";

interface MatchCardProps {
  activity: ActivityWithMatch;
}

export default function MatchCard({ activity }: MatchCardProps) {
  const md = activity.match_details;
  const date = new Date(activity.started_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  // No match details logged yet — show prompt
  if (!md) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between mb-2">
          <p className="font-medium">{activity.name || "Soccer"}</p>
          <span className="text-sm text-gray-500">{date}</span>
        </div>
        <div className="flex gap-4 text-sm text-gray-500 mb-3">
          {activity.distance_miles && <span>{activity.distance_miles} mi</span>}
          {activity.avg_heart_rate && <span>{activity.avg_heart_rate} avg HR</span>}
          {activity.duration_minutes && <span>{Math.round(activity.duration_minutes)} min</span>}
        </div>
        <Link
          href={`/log/${activity.id}`}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          Log details
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-100 dark:border-gray-800">
      {/* Header: league + format */}
      <div className="flex items-center gap-2 mb-1">
        {md.league && (
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {md.league}
          </span>
        )}
        <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 px-2 py-0.5 rounded">
          {md.format}
        </span>
      </div>

      {/* Date + position + result */}
      <p className="text-sm text-gray-500 mb-3">
        {date}
        {md.position && ` · ${md.position}`}
        {md.result && ` · ${md.result}`}
      </p>

      {/* Rating */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-2xl font-bold">{md.rating}/10</span>
        <div className="flex gap-3 text-sm text-gray-500">
          <span>{md.goals} goal{md.goals !== 1 ? "s" : ""} · {md.assists} assist{md.assists !== 1 ? "s" : ""}</span>
        </div>
      </div>

      {/* Strava data */}
      <div className="flex gap-4 text-sm text-gray-500 mb-3">
        {activity.distance_miles && <span>{activity.distance_miles} mi distance</span>}
        {activity.avg_heart_rate && <span>{activity.avg_heart_rate} avg HR</span>}
        {activity.avg_pace && <span>{activity.avg_pace} pace</span>}
      </div>

      {/* Notes */}
      {md.notes && (
        <p className="text-sm text-gray-500 italic">{md.notes}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Create SyncButton component**

Create `src/components/SyncButton.tsx`:

```tsx
"use client";

import { useState } from "react";

export default function SyncButton() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSync() {
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/strava/sync", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        if (data.reconnect) {
          setMessage("Strava disconnected. Please reconnect.");
        } else {
          setMessage("Sync failed — try again in a minute");
        }
        return;
      }

      if (data.synced === 0) {
        setMessage("Already up to date");
      } else {
        setMessage(`Synced ${data.synced} new activit${data.synced === 1 ? "y" : "ies"}`);
      }

      // Reload the page to show new data
      if (data.synced > 0) {
        window.location.reload();
      }
    } catch {
      setMessage("Sync failed — try again in a minute");
    } finally {
      setLoading(false);
      // Clear message after 4 seconds
      setTimeout(() => setMessage(null), 4000);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleSync}
        disabled={loading}
        className="text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700
                   px-3 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800
                   transition disabled:opacity-50"
      >
        {loading ? "Syncing..." : "Sync now"}
      </button>
      {message && (
        <span className="text-sm text-gray-500">{message}</span>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Commit**

```bash
git add src/components/
git commit -m "feat: add UI components (StatCard, RatingDots, Sparkline, RunCard, MatchCard, SyncButton)"
```

---

## Task 11: Match Logging Form + Pages

**Files:**
- Create: `src/components/MatchForm.tsx`, `src/app/log/[activityId]/page.tsx`, `src/app/log/new/page.tsx`

- [ ] **Step 1: Create MatchForm component**

Create `src/components/MatchForm.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Activity } from "@/lib/types";
import RatingDots from "./RatingDots";

const POSITIONS = [
  "GK", "CB", "LB", "RB", "CDM", "CM", "CAM", "LM", "RM", "LW", "RW", "ST",
];

const LEAGUES = [
  "Friday night league",
  "Sunday competitive",
  "Tuesday night league",
  "Pickup",
  "Other",
];

interface MatchFormProps {
  activity?: Activity; // undefined for standalone
}

export default function MatchForm({ activity }: MatchFormProps) {
  const [format, setFormat] = useState<"7v7" | "11v11">("7v7");
  const [league, setLeague] = useState(LEAGUES[0]);
  const [position, setPosition] = useState("CM");
  const [goals, setGoals] = useState(0);
  const [assists, setAssists] = useState(0);
  const [rating, setRating] = useState(7);
  const [result, setResult] = useState("");
  const [notes, setNotes] = useState("");
  const [matchDate, setMatchDate] = useState(
    activity
      ? new Date(activity.started_at).toISOString().slice(0, 16)
      : new Date().toISOString().slice(0, 16)
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activity_id: activity?.id || null,
          format,
          league,
          position,
          goals,
          assists,
          rating,
          result: result || null,
          notes: notes || null,
          match_date: activity ? undefined : new Date(matchDate).toISOString(),
        }),
      });

      if (!res.ok) throw new Error("Failed to save");
      setSaved(true);
    } catch (err) {
      console.error(err);
      alert("Failed to save match details");
    } finally {
      setSaving(false);
    }
  }

  if (saved) {
    return (
      <div className="max-w-lg text-center py-12">
        <h2 className="text-xl font-bold mb-2">Match logged!</h2>
        <a href="/" className="text-blue-600 hover:text-blue-700 font-medium">
          Back to dashboard
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-lg">
      {/* Strava data summary (linked only) */}
      {activity && (
        <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4">
          <p className="text-sm text-gray-500 mb-1">
            {new Date(activity.started_at).toLocaleDateString("en-US", {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}
          </p>
          <p className="font-medium">{activity.name}</p>
          <div className="flex gap-4 mt-2 text-sm text-gray-600">
            {activity.distance_miles && <span>{activity.distance_miles} mi</span>}
            {activity.avg_heart_rate && <span>{activity.avg_heart_rate} bpm avg</span>}
            {activity.duration_minutes && <span>{Math.round(activity.duration_minutes)} min</span>}
          </div>
        </div>
      )}

      {/* Match date (standalone only) */}
      {!activity && (
        <div>
          <label className="block text-sm font-medium mb-2">Match date</label>
          <input
            type="datetime-local"
            value={matchDate}
            onChange={(e) => setMatchDate(e.target.value)}
            required
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                       dark:bg-gray-900 dark:border-gray-700"
          />
        </div>
      )}

      {/* Format */}
      <div>
        <label className="block text-sm font-medium mb-2">Format</label>
        <div className="flex gap-2">
          {(["7v7", "11v11"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFormat(f)}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition
                ${format === f
                  ? "bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-900 dark:border-blue-600 dark:text-blue-200"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400"
                }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* League */}
      <div>
        <label className="block text-sm font-medium mb-2">League</label>
        <select
          value={league}
          onChange={(e) => setLeague(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                     dark:bg-gray-900 dark:border-gray-700"
        >
          {LEAGUES.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
      </div>

      {/* Position */}
      <div>
        <label className="block text-sm font-medium mb-2">Position</label>
        <div className="flex flex-wrap gap-2">
          {POSITIONS.map((pos) => (
            <button
              key={pos}
              type="button"
              onClick={() => setPosition(pos)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition
                ${position === pos
                  ? "bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-900 dark:border-blue-600 dark:text-blue-200"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400"
                }`}
            >
              {pos}
            </button>
          ))}
        </div>
      </div>

      {/* Goals + Assists */}
      <div className="flex gap-6">
        {[
          { label: "Goals", value: goals, setValue: setGoals },
          { label: "Assists", value: assists, setValue: setAssists },
        ].map(({ label, value, setValue }) => (
          <div key={label}>
            <label className="block text-sm font-medium mb-2">{label}</label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setValue(Math.max(0, value - 1))}
                className="w-8 h-8 rounded-full border border-gray-200 flex items-center
                           justify-center text-gray-500 hover:bg-gray-50
                           dark:border-gray-700"
              >
                -
              </button>
              <span className="text-xl font-medium w-6 text-center">{value}</span>
              <button
                type="button"
                onClick={() => setValue(value + 1)}
                className="w-8 h-8 rounded-full border border-gray-200 flex items-center
                           justify-center text-gray-500 hover:bg-gray-50
                           dark:border-gray-700"
              >
                +
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Result */}
      <div>
        <label className="block text-sm font-medium mb-2">Result</label>
        <input
          type="text"
          value={result}
          onChange={(e) => setResult(e.target.value)}
          placeholder="W 6-3, L 2-4, D 1-1"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                     dark:bg-gray-900 dark:border-gray-700"
        />
      </div>

      {/* Rating */}
      <div>
        <label className="block text-sm font-medium mb-2">
          Rating: {rating}/10
        </label>
        <RatingDots value={rating} onChange={setRating} />
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium mb-2">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="How did you play? What went well? What didn't?"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                     dark:bg-gray-900 dark:border-gray-700"
        />
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={saving}
        className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium
                   hover:bg-blue-700 transition disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save match details"}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Create linked match logging page**

Create `src/app/log/[activityId]/page.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import MatchForm from "@/components/MatchForm";
import { Activity } from "@/lib/types";

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

  return (
    <div className="min-h-screen p-6 max-w-2xl mx-auto">
      <a href="/" className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-block">
        &larr; Back to dashboard
      </a>
      <h1 className="text-2xl font-bold mb-6">Log match details</h1>
      <MatchForm activity={activity as Activity} />
    </div>
  );
}
```

- [ ] **Step 3: Create standalone match logging page**

Create `src/app/log/new/page.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import MatchForm from "@/components/MatchForm";

export default async function NewMatchPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="min-h-screen p-6 max-w-2xl mx-auto">
      <a href="/" className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-block">
        &larr; Back to dashboard
      </a>
      <h1 className="text-2xl font-bold mb-6">Log match (no Strava)</h1>
      <MatchForm />
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/MatchForm.tsx src/app/log/
git commit -m "feat: add match logging form with linked and standalone pages"
```

---

## Task 12: Dashboard Page

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Create the dashboard**

Replace `src/app/page.tsx` with:

```tsx
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
  const dateRange = `${fourWeeksAgo.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

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
          detail={matchCount > 0 ? `${format7}x 7v7 · ${format11}x 11v11` : undefined}
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
```

- [ ] **Step 2: Verify the app builds**

```bash
npm run build
```

Expected: Build succeeds with no errors. (You'll see warnings about Supabase env vars if they're placeholders — that's fine.)

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add dashboard with stat cards, sparkline, match/run feeds"
```

---

## Task 13: Final Integration Check

- [ ] **Step 1: Run all tests**

```bash
npx vitest run
```

Expected: All Strava helper tests pass.

- [ ] **Step 2: Run type check**

```bash
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 3: Run the dev server and verify pages load**

```bash
npm run dev
```

Manual checks:
1. `http://localhost:3000` — should redirect to `/login` (no session)
2. `http://localhost:3000/login` — should show magic link form
3. After login (once Supabase is configured): dashboard loads with empty state
4. "Connect Strava" button visible when no tokens
5. "Log match" button links to `/log/new`

- [ ] **Step 4: Commit any fixes from integration check**

If any fixes were needed:

```bash
git add -A
git commit -m "fix: address issues found during integration check"
```

---

## Summary

| Task | Description | Commits |
|------|-------------|---------|
| 1 | Project scaffolding | 1 |
| 2 | Database schema SQL | 1 |
| 3 | TypeScript types | 1 |
| 4 | Supabase client setup | 1 |
| 5 | Auth middleware + login | 1 |
| 6 | Strava helpers (TDD) | 1 |
| 7 | Strava OAuth routes | 1 |
| 8 | Strava sync route | 1 |
| 9 | Activities API route | 1 |
| 10 | UI components | 1 |
| 11 | Match form + log pages | 1 |
| 12 | Dashboard page | 1 |
| 13 | Final integration check | 0-1 |

**Total: ~12-13 commits, 13 tasks**

### Post-plan: Before going live

These are not implementation tasks — they're manual steps you do once:

1. **Run `supabase/schema.sql`** in your Supabase dashboard SQL editor
2. **Update `.env.local`** with real Supabase URL + keys from your project dashboard
3. **Configure Strava OAuth** — set the callback URL in your Strava API settings to `http://localhost:3000/api/strava/callback` (and later your Vercel URL)
4. **Deploy to Vercel** — connect repo, add env vars in Vercel dashboard
