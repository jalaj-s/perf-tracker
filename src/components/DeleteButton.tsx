"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface DeleteButtonProps {
  activityId?: string;
  matchDetailId?: string;
}

export default function DeleteButton({ activityId, matchDetailId }: DeleteButtonProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);

  async function handleDelete() {
    const params = new URLSearchParams();
    if (activityId) params.set("id", activityId);
    if (matchDetailId) params.set("match_detail_id", matchDetailId);

    const res = await fetch(`/api/activities?${params}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/");
      router.refresh();
    } else {
      alert("Failed to delete");
    }
  }

  if (confirming) {
    return (
      <span className="flex items-center gap-2 text-sm">
        <span className="text-gray-500">Delete?</span>
        <button onClick={handleDelete} className="text-red-500 font-medium">Yes</button>
        <button onClick={() => setConfirming(false)} className="text-gray-400">No</button>
      </span>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="text-sm text-red-400 hover:text-red-500 transition"
    >
      Delete
    </button>
  );
}
