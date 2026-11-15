"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const colors = ["#287d68", "#72aa87", "#e4b85b"];

export function BatchFlowChart({
  data,
}: {
  data: { month: string; count: number }[];
}) {
  return (
    <div className="chart-wrap" aria-label="Batch registrations over the last 90 days">
      <ResponsiveContainer width="100%" height={230}>
        <AreaChart data={data} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="batch-flow-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#287d68" stopOpacity={0.28} />
              <stop offset="95%" stopColor="#287d68" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#e8eee8" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip />
          <Area
            type="monotone"
            dataKey="count"
            name="Registered batches"
            stroke="#287d68"
            strokeWidth={2}
            fill="url(#batch-flow-fill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function OrgTypePie({
  data,
}: {
  data: { kind: string; count: number }[];
}) {
  const chartData = data.map((item) => ({ ...item, name: item.kind.toLowerCase() }));
  return (
    <div className="chart-wrap org-chart" aria-label="Organizations by type">
      <ResponsiveContainer width="100%" height={230}>
        <PieChart>
          <Pie
            data={chartData}
            dataKey="count"
            nameKey="name"
            innerRadius={52}
            outerRadius={82}
            paddingAngle={3}
          >
            {chartData.map((item, index) => (
              <Cell key={item.kind} fill={colors[index % colors.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend verticalAlign="bottom" iconType="circle" />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
