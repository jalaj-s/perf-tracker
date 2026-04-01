"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { League } from "@/lib/types";

interface LeagueFilterProps {
  leagues: League[];
}

export default function LeagueFilter({ leagues }: LeagueFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get("league") || "all";

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      params.delete("league");
    } else {
      params.set("league", value);
    }
    const qs = params.toString();
    router.push(qs ? `/?${qs}` : "/");
  }

  if (leagues.length === 0) return null;

  return (
    <select
      value={current}
      onChange={(e) => handleChange(e.target.value)}
      className="text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700
                 rounded-md px-2 py-1 text-gray-600 dark:text-gray-400"
    >
      <option value="all">All leagues</option>
      {leagues.map((l) => (
        <option key={l.id} value={l.id}>
          {l.name} · {l.format}
        </option>
      ))}
    </select>
  );
}
