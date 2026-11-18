"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import { useLocale, useTranslations } from "use-intl";
import { formatCurrency, localeForCountry } from "@/lib/locale/format";
import { useSpeciesLabel } from "@/lib/patients/use-species-label";

const SPECIES_COLORS: Record<string, string> = {
  Canine: "#3b82f6",
  Feline: "#f59e0b",
  Avian: "#10b981",
  Rabbit: "#8b5cf6",
  Reptile: "#ef4444",
  Equine: "#06b6d4",
  Other: "#6b7280",
};

type AppointmentChartPoint = {
  date: string;
  dateInput?: string;
  completed: number;
  scheduled: number;
  cancelled: number;
};

type SpeciesChartPoint = {
  name: string;
  species?: string;
  value: number;
};

type RevenueChartPoint = {
  date: string;
  dateInput?: string;
  revenue: number;
};

type ProductionByDoctorPoint = {
  doctorName: string;
  production: number;
};

function PieLabel({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
  name,
}: {
  cx: number;
  cy: number;
  midAngle: number;
  innerRadius: number;
  outerRadius: number;
  percent: number;
  name: string;
}) {
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 1.4;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  if (percent < 0.03) return null;
  return (
    <text
      x={x}
      y={y}
      fill="currentColor"
      className="text-xs fill-foreground"
      textAnchor={x > cx ? "start" : "end"}
      dominantBaseline="central"
    >
      {name} ({(percent * 100).toFixed(0)}%)
    </text>
  );
}

export function DashboardCharts({
  appointmentsByDay,
  speciesDistribution,
  revenueByDay,
  productionByDoctor,
  currency,
  country,
}: {
  appointmentsByDay: AppointmentChartPoint[];
  speciesDistribution: SpeciesChartPoint[];
  revenueByDay: RevenueChartPoint[];
  productionByDoctor: ProductionByDoctorPoint[];
  currency: string;
  country: string;
}) {
  const t = useTranslations("dashboard.charts");
  const locale = useLocale();
  const speciesLabel = useSpeciesLabel();
  const fmtMoney = (value: number) => formatCurrency(value, currency, country, locale);
  const fmtAxisMoney = (value: number) =>
    new Intl.NumberFormat(localeForCountry(country, locale), {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);

  // The server labels days in English; other languages relabel from the raw date.
  const dayLabel = (input: string | undefined, fallback: string, options: Intl.DateTimeFormatOptions) =>
    input && !locale.startsWith("en")
      ? new Date(`${input}T00:00:00.000Z`).toLocaleDateString(locale, { ...options, timeZone: "UTC" })
      : fallback;
  const appointmentsData = appointmentsByDay.map((d) => ({
    ...d,
    date: dayLabel(d.dateInput, d.date, { weekday: "short" }),
  }));
  const revenueData = revenueByDay.map((d) => ({
    ...d,
    date: dayLabel(d.dateInput, d.date, { month: "short", day: "2-digit" }),
  }));
  const speciesData = speciesDistribution.map((d) => ({
    ...d,
    label: d.species ? speciesLabel(d.species) : d.name,
  }));

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 font-heading text-lg font-semibold">
            {t("appointmentsWeek")}
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={appointmentsData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="date"
                className="text-xs fill-muted-foreground"
                tick={{ fontSize: 12 }}
              />
              <YAxis
                allowDecimals={false}
                className="text-xs fill-muted-foreground"
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "0.5rem",
                  fontSize: "0.875rem",
                }}
              />
              <Legend wrapperStyle={{ fontSize: "0.75rem" }} />
              <Bar
                dataKey="completed"
                name={t("completed")}
                stackId="a"
                fill="#22c55e"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="scheduled"
                name={t("scheduled")}
                stackId="a"
                fill="#3b82f6"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="cancelled"
                name={t("cancelled")}
                stackId="a"
                fill="#ef4444"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 font-heading text-lg font-semibold">
            {t("species")}
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={speciesData}
                nameKey="label"
                cx="50%"
                cy="50%"
                outerRadius={100}
                dataKey="value"
                label={PieLabel}
              >
                {speciesData.map((entry) => (
                  <Cell
                    key={entry.name}
                    fill={SPECIES_COLORS[entry.name] ?? "#6b7280"}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "0.5rem",
                  fontSize: "0.875rem",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 font-heading text-lg font-semibold">
            {t("collections30")}
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="date"
                className="text-xs fill-muted-foreground"
                tick={{ fontSize: 12 }}
              />
              <YAxis
                className="text-xs fill-muted-foreground"
                tick={{ fontSize: 12 }}
                tickFormatter={fmtAxisMoney}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "0.5rem",
                  fontSize: "0.875rem",
                }}
                formatter={(value: number) => [fmtMoney(value), t("collections")]}
              />
              <Line
                type="monotone"
                dataKey="revenue"
                name={t("collections")}
                stroke="#0d9488"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: "#0d9488" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 font-heading text-lg font-semibold">
            {t("byDoctor")}
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={productionByDoctor}
              layout="vertical"
              margin={{ left: 16, right: 24 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                type="number"
                className="text-xs fill-muted-foreground"
                tick={{ fontSize: 12 }}
                tickFormatter={fmtAxisMoney}
              />
              <YAxis
                dataKey="doctorName"
                type="category"
                width={120}
                className="text-xs fill-muted-foreground"
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "0.5rem",
                  fontSize: "0.875rem",
                }}
                formatter={(value: number) => [fmtMoney(value), t("collections")]}
              />
              <Bar
                dataKey="production"
                name={t("collections")}
                fill="#14b8a6"
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
}
