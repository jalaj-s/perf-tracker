interface StatCardProps {
  label: string;
  value: string | number;
  detail?: string;
}

export default function StatCard({ label, value, detail }: StatCardProps) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-100 dark:border-gray-800">
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      {detail && <p className="text-sm text-gray-400 mt-1">{detail}</p>}
    </div>
  );
}
