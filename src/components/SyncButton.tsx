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
          setMessage("Sync failed \u2014 try again in a minute");
        }
        return;
      }

      if (data.synced === 0) {
        setMessage("Already up to date");
      } else {
        setMessage(`Synced ${data.synced} new activit${data.synced === 1 ? "y" : "ies"}`);
      }

      if (data.synced > 0) {
        window.location.reload();
      }
    } catch {
      setMessage("Sync failed \u2014 try again in a minute");
    } finally {
      setLoading(false);
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
