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
  activity?: Activity;
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
