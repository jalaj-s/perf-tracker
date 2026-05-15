"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { League } from "@/lib/types";

interface LeagueManagerProps {
  initialLeagues: League[];
  matchCountByLeague: Record<string, number>;
}

export default function LeagueManager({ initialLeagues, matchCountByLeague }: LeagueManagerProps) {
  const router = useRouter();
  const [leagues, setLeagues] = useState<League[]>(initialLeagues);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Edit form state
  const [draftName, setDraftName] = useState("");
  const [draftFormat, setDraftFormat] = useState<"7v7" | "11v11">("7v7");
  const [draftLocation, setDraftLocation] = useState("");
  const [draftOrganizer, setDraftOrganizer] = useState("");
  const [draftCoed, setDraftCoed] = useState(false);

  function startEdit(league: League) {
    setEditingId(league.id);
    setDraftName(league.name);
    setDraftFormat(league.format);
    setDraftLocation(league.location || "");
    setDraftOrganizer(league.organizer || "");
    setDraftCoed(league.is_coed);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(id: string) {
    if (!draftName.trim()) return;
    setBusyId(id);

    try {
      const res = await fetch(`/api/leagues/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draftName.trim(),
          format: draftFormat,
          location: draftLocation.trim() || null,
          organizer: draftOrganizer.trim() || null,
          is_coed: draftCoed,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Failed to save");
        return;
      }

      const updated: League = await res.json();
      setLeagues((prev) =>
        prev.map((l) => (l.id === id ? updated : l)).sort((a, b) => a.name.localeCompare(b.name))
      );
      setEditingId(null);
      router.refresh();
    } catch {
      alert("Failed to save");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteLeague(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/leagues/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Failed to delete");
        setConfirmingDeleteId(null);
        return;
      }
      setLeagues((prev) => prev.filter((l) => l.id !== id));
      setConfirmingDeleteId(null);
      router.refresh();
    } catch {
      alert("Failed to delete");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-3">
      {leagues.map((league) => {
        const matchCount = matchCountByLeague[league.id] || 0;
        const isEditing = editingId === league.id;
        const isConfirmingDelete = confirmingDeleteId === league.id;
        const isBusy = busyId === league.id;

        return (
          <div
            key={league.id}
            className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-100 dark:border-gray-800"
          >
            {isEditing ? (
              <div className="space-y-3">
                <input
                  type="text"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
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
                        onClick={() => setDraftFormat(f)}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition
                          ${draftFormat === f
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
                  value={draftLocation}
                  onChange={(e) => setDraftLocation(e.target.value)}
                  placeholder="Location (optional)"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                             dark:bg-gray-900 dark:border-gray-700"
                />
                <input
                  type="text"
                  value={draftOrganizer}
                  onChange={(e) => setDraftOrganizer(e.target.value)}
                  placeholder="Organizer (optional)"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                             dark:bg-gray-900 dark:border-gray-700"
                />
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draftCoed}
                    onChange={(e) => setDraftCoed(e.target.checked)}
                    className="rounded"
                  />
                  Co-ed
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => saveEdit(league.id)}
                    disabled={isBusy || !draftName.trim()}
                    className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium
                               hover:bg-blue-700 transition disabled:opacity-50"
                  >
                    {isBusy ? "Saving..." : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={cancelEdit}
                    disabled={isBusy}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between mb-1">
                  <div>
                    <p className="font-medium">{league.name}</p>
                    <div className="flex flex-wrap gap-x-2 gap-y-1 text-xs text-gray-500 mt-1">
                      <span className="bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
                        {league.format}
                      </span>
                      {league.location && <span>{league.location}</span>}
                      {league.organizer && <span>· {league.organizer}</span>}
                      {league.is_coed && <span>· Co-ed</span>}
                    </div>
                  </div>
                  <span className="text-xs text-gray-400">
                    {matchCount} match{matchCount === 1 ? "" : "es"}
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-3">
                  <button
                    onClick={() => startEdit(league)}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Edit
                  </button>
                  {isConfirmingDelete ? (
                    <span className="flex items-center gap-2 text-sm">
                      <span className="text-gray-500">Delete?</span>
                      <button
                        onClick={() => deleteLeague(league.id)}
                        disabled={isBusy}
                        className="text-red-500 font-medium disabled:opacity-50"
                      >
                        {isBusy ? "..." : "Yes"}
                      </button>
                      <button
                        onClick={() => setConfirmingDeleteId(null)}
                        disabled={isBusy}
                        className="text-gray-400"
                      >
                        No
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setConfirmingDeleteId(league.id)}
                      disabled={matchCount > 0}
                      title={matchCount > 0 ? "Delete the matches in this league first" : undefined}
                      className="text-sm text-red-400 hover:text-red-500 transition
                                 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-red-400"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
