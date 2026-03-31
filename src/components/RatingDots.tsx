"use client";

interface RatingDotsProps {
  value: number;
  onChange?: (value: number) => void;
  readonly?: boolean;
}

export default function RatingDots({ value, onChange, readonly }: RatingDotsProps) {
  return (
    <div className="flex gap-1.5">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
        <button
          key={n}
          type="button"
          disabled={readonly}
          onClick={() => onChange?.(n)}
          className={`w-8 h-8 rounded-full text-xs font-medium transition
            ${n <= value
              ? "bg-green-500 text-white"
              : "bg-gray-100 text-gray-400 dark:bg-gray-800"
            }
            ${readonly ? "cursor-default" : "cursor-pointer hover:scale-110"}
          `}
        >
          {n}
        </button>
      ))}
    </div>
  );
}
