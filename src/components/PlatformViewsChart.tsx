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
  compass_views: number | null;
}

interface PlatformViewsChartProps {
  data: PlatformViewEntry[];
  zillowVisible?: boolean;
  redfinVisible?: boolean;
  compassVisible?: boolean;
}

const platformConfig = {
  zillow: { key: "zillow_views" as const, color: "#006AFF", label: "Zillow" },
  redfin: { key: "redfin_views" as const, color: "#A02021", label: "Redfin" },
  compass: { key: "compass_views" as const, color: "#000000", label: "Compass" },
};

function formatDate(dateStr: string) {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function PlatformViewsChart({
  data,
  zillowVisible,
  redfinVisible,
  compassVisible,
}: PlatformViewsChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        No view data yet
      </div>
    );
  }

  // Auto-detect which platforms have data (if visibility props not provided)
  const showZillow = zillowVisible ?? data.some((d) => d.zillow_views != null);
  const showRedfin = redfinVisible ?? data.some((d) => d.redfin_views != null);
  const showCompass = compassVisible ?? data.some((d) => d.compass_views != null);

  // Carry forward last known value when a platform has null for a given date
  let lastZillow = 0;
  let lastRedfin = 0;
  let lastCompass = 0;

  const chartData = data.map((entry) => {
    if (entry.zillow_views != null) lastZillow = entry.zillow_views;
    if (entry.redfin_views != null) lastRedfin = entry.redfin_views;
    if (entry.compass_views != null) lastCompass = entry.compass_views;

    return {
      date: formatDate(entry.date),
      rawDate: entry.date,
      ...(showZillow && { Zillow: lastZillow }),
      ...(showRedfin && { Redfin: lastRedfin }),
      ...(showCompass && { Compass: lastCompass }),
    };
  });

  const visiblePlatforms = [
    ...(showZillow ? [platformConfig.zillow] : []),
    ...(showRedfin ? [platformConfig.redfin] : []),
    ...(showCompass ? [platformConfig.compass] : []),
  ];

  return (
    <ResponsiveContainer width="100%" height={260}>
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
