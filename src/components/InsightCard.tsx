interface InsightCardProps {
  title: string;
  children: React.ReactNode;
}

export default function InsightCard({ title, children }: InsightCardProps) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-100 dark:border-gray-800">
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{title}</p>
      <div className="text-sm text-gray-500">{children}</div>
    </div>
  );
}
