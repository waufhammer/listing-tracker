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

interface DataPoint {
  date: string;
  showings: number;
  previews: number;
  openHouseGroups: number;
}

interface CumulativeActivityChartProps {
  data: DataPoint[];
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function CumulativeActivityChart({ data }: CumulativeActivityChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        No activity data yet
      </div>
    );
  }

  const chartData = data.map((d) => ({
    date: formatDate(d.date),
    Showings: d.showings,
    Previews: d.previews,
    "OH Groups": d.openHouseGroups,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          tickLine={false}
          axisLine={{ stroke: "#e5e7eb" }}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#9ca3af" }}
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
        <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
        <Line
          type="monotone"
          dataKey="Showings"
          stroke="#00B04F"
          strokeWidth={2}
          dot={{ r: 2, fill: "#00B04F" }}
          activeDot={{ r: 4 }}
        />
        <Line
          type="monotone"
          dataKey="Previews"
          stroke="#006AFF"
          strokeWidth={2}
          dot={{ r: 2, fill: "#006AFF" }}
          activeDot={{ r: 4 }}
        />
        <Line
          type="monotone"
          dataKey="OH Groups"
          stroke="#F59E0B"
          strokeWidth={2}
          dot={{ r: 2, fill: "#F59E0B" }}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
