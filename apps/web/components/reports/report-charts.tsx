"use client";

import { useTranslations } from "use-intl";

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type RevenueDailyPoint = {
  date: string;
  amount: number;
};

type ServiceCountPoint = {
  name: string;
  count: number;
};

export function RevenueLineChart({
  daily,
  formatCurrency,
}: {
  daily: RevenueDailyPoint[];
  formatCurrency: (value: number) => string;
}) {
  const t = useTranslations("reports.charts");
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={daily}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 12 }}
          className="text-muted-foreground"
        />
        <YAxis
          tick={{ fontSize: 12 }}
          className="text-muted-foreground"
          tickFormatter={(value) => `$${value}`}
        />
        <Tooltip
          formatter={(value: number) => [formatCurrency(value), t("netCollections")]}
          contentStyle={{
            backgroundColor: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "0.5rem",
          }}
        />
        <Line
          type="monotone"
          dataKey="amount"
          stroke="#0d9488"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function ServicesCountChart({ items }: { items: ServiceCountPoint[] }) {
  const t = useTranslations("reports.charts");
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={items}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11 }}
          className="text-muted-foreground"
          angle={-25}
          textAnchor="end"
          height={60}
        />
        <YAxis
          tick={{ fontSize: 12 }}
          className="text-muted-foreground"
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "0.5rem",
          }}
        />
        <Bar dataKey="count" name={t("count")} fill="#0d9488" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
