"use client";

interface ActivitySummaryChartProps {
  data: { label: string; value: number }[];
}

export default function ActivitySummaryChart({ data }: ActivitySummaryChartProps) {
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="space-y-3">
      {data.map((item) => (
        <div key={item.label} className="flex items-center gap-3">
          <span className="text-sm text-gray-600 w-40 flex-shrink-0 text-right">
            {item.label}
          </span>
          <div className="flex-1 h-7 bg-gray-50 rounded-md overflow-hidden">
            <div
              className="h-full bg-gray-800 rounded-md flex items-center justify-end pr-2 transition-all"
              style={{ width: `${Math.max((item.value / maxValue) * 100, item.value > 0 ? 8 : 0)}%` }}
            >
              {item.value > 0 && (
                <span className="text-xs font-semibold text-white">{item.value}</span>
              )}
            </div>
          </div>
          {item.value === 0 && (
            <span className="text-xs text-gray-300 w-6">0</span>
          )}
        </div>
      ))}
    </div>
  );
}
