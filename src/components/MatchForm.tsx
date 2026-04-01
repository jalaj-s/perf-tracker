"use client";

import { useState } from "react";
import { Activity, League } from "@/lib/types";
import RatingDots from "./RatingDots";

const POSITIONS = [
  "GK", "CB", "LB", "RB", "CDM", "CM", "CAM", "LM", "RM", "LW", "RW", "ST",
];

interface MatchFormProps {
  activity?: Activity;
  initialLeagues: League[];
}

export default function MatchForm({ activity, initialLeagues }: MatchFormProps) {
  const [leagues, setLeagues] = useState<League[]>(initialLeagues);
  const [leagueId, setLeagueId] = useState(leagues[0]?.id || "");
  const [showNewLeague, setShowNewLeague] = useState(leagues.length === 0);
  const [positions, setPositions] = useState<string[]>(["CM"]);
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

  // New league form state
  const [newName, setNewName] = useState("");
  const [newFormat, setNewFormat] = useState<"7v7" | "11v11">("7v7");
  const [newLocation, setNewLocation] = useState("");
  const [newOrganizer, setNewOrganizer] = useState("");
  const [newCoed, setNewCoed] = useState(false);
  const [savingLeague, setSavingLeague] = useState(false);

  const selectedLeague = leagues.find((l) => l.id === leagueId);

  function togglePosition(pos: string) {
    setPositions((prev) =>
      prev.includes(pos) ? prev.filter((p) => p !== pos) : [...prev, pos]
    );
  }

  async function handleCreateLeague() {
    if (!newName.trim()) return;
    setSavingLeague(true);

    try {
      const res = await fetch("/api/leagues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          format: newFormat,
          location: newLocation.trim() || null,
          organizer: newOrganizer.trim() || null,
          is_coed: newCoed,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Failed to create league");
        return;
      }

      const league: League = await res.json();
      setLeagues((prev) => [...prev, league].sort((a, b) => a.name.localeCompare(b.name)));
      setLeagueId(league.id);
      setShowNewLeague(false);
      setNewName("");
      setNewLocation("");
      setNewOrganizer("");
      setNewCoed(false);
    } catch {
      alert("Failed to create league");
    } finally {
      setSavingLeague(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!leagueId) {
      alert("Please select or create a league");
      return;
    }
    if (positions.length === 0) {
      alert("Please select at least one position");
      return;
    }
    setSaving(true);

    try {
      const res = await fetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activity_id: activity?.id || null,
          league_id: leagueId,
          positions,
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

      {/* League picker */}
      <div>
        <label className="block text-sm font-medium mb-2">League</label>
        {!showNewLeague && leagues.length > 0 && (
          <>
            <select
              value={leagueId}
              onChange={(e) => setLeagueId(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                         dark:bg-gray-900 dark:border-gray-700 mb-2"
            >
              {leagues.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} · {l.format}
                </option>
              ))}
            </select>
            {selectedLeague && (
              <div className="flex gap-2 text-xs text-gray-500 mb-2">
                <span className="bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">{selectedLeague.format}</span>
                {selectedLeague.location && <span>{selectedLeague.location}</span>}
                {selectedLeague.organizer && <span>· {selectedLeague.organizer}</span>}
                {selectedLeague.is_coed && <span>· Co-ed</span>}
              </div>
            )}
          </>
        )}

        {!showNewLeague && (
          <button
            type="button"
            onClick={() => setShowNewLeague(true)}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            + New league
          </button>
        )}

        {/* Inline new league form */}
        {showNewLeague && (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="League name"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                         dark:bg-gray-900 dark:border-gray-700"
            />
            <div>
              <label className="block text-xs text-gray-500 mb-1">Format</label>
              <div className="flex gap-2">
                {(["7v7", "11v11"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setNewFormat(f)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition
                      ${newFormat === f
                        ? "bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-900 dark:border-blue-600 dark:text-blue-200"
                        : "border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400"
                      }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
            <input
              type="text"
              value={newLocation}
              onChange={(e) => setNewLocation(e.target.value)}
              placeholder="Location (optional)"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                         dark:bg-gray-900 dark:border-gray-700"
            />
            <input
              type="text"
              value={newOrganizer}
              onChange={(e) => setNewOrganizer(e.target.value)}
              placeholder="Organizer (optional)"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                         dark:bg-gray-900 dark:border-gray-700"
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={newCoed}
                onChange={(e) => setNewCoed(e.target.checked)}
                className="rounded"
              />
              Co-ed
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCreateLeague}
                disabled={savingLeague || !newName.trim()}
                className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium
                           hover:bg-blue-700 transition disabled:opacity-50"
              >
                {savingLeague ? "Saving..." : "Save league"}
              </button>
              {leagues.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowNewLeague(false)}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Position (multi-select) */}
      <div>
        <label className="block text-sm font-medium mb-2">
          Position{positions.length > 1 ? "s" : ""} ({positions.join(", ") || "none"})
        </label>
        <div className="flex flex-wrap gap-2">
          {POSITIONS.map((pos) => (
            <button
              key={pos}
              type="button"
              onClick={() => togglePosition(pos)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition
                ${positions.includes(pos)
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
