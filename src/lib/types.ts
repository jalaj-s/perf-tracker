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

export interface MatchDetails {
  id: string;
  activity_id: string | null;
  user_id: string;
  league_id: string;
  result: string | null;
  positions: string[] | null;
  goals: number;
  assists: number;
  rating: number | null;
  notes: string | null;
  match_date: string;
  created_at: string;
}

export interface MatchDetailsWithLeague extends MatchDetails {
  league: League;
}

export interface ActivityWithMatch extends Activity {
  match_details: MatchDetailsWithLeague | null;
}

export interface StravaTokens {
  user_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: number;
  strava_athlete_id: number | null;
  updated_at: string;
}

export interface StravaActivity {
  id: number;
  name: string;
  type: string;
  sport_type: string;
  start_date: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  average_heartrate?: number;
  max_heartrate?: number;
  calories?: number;
  total_elevation_gain: number;
}
