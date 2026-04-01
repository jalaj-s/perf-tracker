"use client";

import { useRouter, useSearchParams } from "next/navigation";

const RANGES = [
  { key: "4w", label: "4W" },
  { key: "3m", label: "3M" },
  { key: "6m", label: "6M" },
  { key: "1y", label: "1Y" },
  { key: "all", label: "All" },
];

export default function RangePicker() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get("range") || "4w";

  function handleClick(key: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (key === "4w") {
      params.delete("range");
    } else {
      params.set("range", key);
    }
    const qs = params.toString();
    router.push(qs ? `/?${qs}` : "/");
  }

  return (
    <div className="flex gap-1">
      {RANGES.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => handleClick(key)}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition
            ${current === key
              ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
              : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
            }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
