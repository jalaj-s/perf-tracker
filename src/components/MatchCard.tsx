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
      <div className="flex items-center gap-2 mb-1">
        {md.league && (
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {md.league.name}
          </span>
        )}
        <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 px-2 py-0.5 rounded">
          {md.league.format}
        </span>
      </div>

      <p className="text-sm text-gray-500 mb-3">
        {date}
        {md.positions && ` · ${md.positions.join(" / ")}`}
        {md.result && ` · ${md.result}`}
      </p>

      <div className="flex items-center gap-3 mb-3">
        {md.rating && <span className="text-2xl font-bold">{md.rating}/10</span>}
        <div className="flex gap-3 text-sm text-gray-500">
          <span>{md.goals} goal{md.goals !== 1 ? "s" : ""} · {md.assists} assist{md.assists !== 1 ? "s" : ""}</span>
        </div>
      </div>

      <div className="flex gap-4 text-sm text-gray-500 mb-3">
        {activity.distance_miles && <span>{activity.distance_miles} mi distance</span>}
        {activity.avg_heart_rate && <span>{activity.avg_heart_rate} avg HR</span>}
        {activity.avg_pace && <span>{activity.avg_pace} pace</span>}
      </div>

      {md.notes && (
        <p className="text-sm text-gray-500 italic mb-3">{md.notes}</p>
      )}

      <Link
        href={`/log/${activity.id}`}
        className="text-sm text-gray-400 hover:text-gray-600 font-medium"
      >
        Edit
      </Link>
    </div>
  );
}
