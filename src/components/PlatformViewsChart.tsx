"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface PlatformViewEntry {
  date: string;
  zillow_views: number | null;
  redfin_views: number | null;
  realtor_views: number | null;
}

interface PlatformViewsChartProps {
  data: PlatformViewEntry[];
  zillowVisible: boolean;
  redfinVisible: boolean;
  realtorVisible: boolean;
}

const platformConfig = {
  zillow: { key: "zillow_views" as const, color: "#006AFF", label: "Zillow" },
  redfin: { key: "redfin_views" as const, color: "#A02021", label: "Redfin" },
  realtor: {
    key: "realtor_views" as const,
    color: "#D92228",
    label: "Realtor.com",
  },
};

function formatDate(dateStr: string) {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function PlatformViewsChart({
  data,
  zillowVisible,
  redfinVisible,
  realtorVisible,
}: PlatformViewsChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        No view data yet
      </div>
    );
  }

  const chartData = data.map((entry) => ({
    date: formatDate(entry.date),
    rawDate: entry.date,
    ...(zillowVisible && { Zillow: entry.zillow_views ?? 0 }),
    ...(redfinVisible && { Redfin: entry.redfin_views ?? 0 }),
    ...(realtorVisible && { "Realtor.com": entry.realtor_views ?? 0 }),
  }));

  const visiblePlatforms = [
    ...(zillowVisible ? [platformConfig.zillow] : []),
    ...(redfinVisible ? [platformConfig.redfin] : []),
    ...(realtorVisible ? [platformConfig.realtor] : []),
  ];

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart
        data={chartData}
        margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 12, fill: "#6b7280" }}
          tickLine={false}
          axisLine={{ stroke: "#e5e7eb" }}
        />
        <YAxis
          tick={{ fontSize: 12, fill: "#6b7280" }}
          tickLine={false}
          axisLine={{ stroke: "#e5e7eb" }}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            fontSize: "13px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: "13px", paddingTop: "8px" }}
        />
        {visiblePlatforms.map((platform) => (
          <Line
            key={platform.key}
            type="monotone"
            dataKey={platform.label}
            stroke={platform.color}
            strokeWidth={2}
            dot={{ r: 3, fill: platform.color }}
            activeDot={{ r: 5 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
