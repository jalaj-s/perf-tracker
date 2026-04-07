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
    <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-100 dark:border-gray-800">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 shrink-0 rounded-full bg-blue-50 dark:bg-blue-950 flex items-center justify-center text-blue-600 font-bold text-sm">
          R
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{activity.name || "Run"}</p>
          <p className="text-sm text-gray-500">{date}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500 mt-2 ml-[52px]">
        {activity.distance_miles && (
          <span>{activity.distance_miles} mi</span>
        )}
        {activity.avg_pace && <span>{activity.avg_pace}</span>}
        {activity.avg_heart_rate && <span>{activity.avg_heart_rate} bpm</span>}
      </div>
    </div>
  );
}
