import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface Props {
  data: { categoryName: string; amount: number; percent: number }[];
}

function formatCurrency(value: number) {
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export function CategoryBarChart({ data }: Props) {
  if (data.length === 0) {
    return <p className="empty-state">No expenses recorded for this month yet.</p>;
  }

  const chartData = [...data].sort((a, b) => a.amount - b.amount);

  return (
    <ResponsiveContainer width="100%" height={Math.max(160, chartData.length * 36)}>
      <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
        <CartesianGrid horizontal={false} stroke="var(--gridline)" />
        <XAxis type="number" tickFormatter={formatCurrency} stroke="var(--text-muted)" fontSize={12} />
        <YAxis
          type="category"
          dataKey="categoryName"
          width={100}
          stroke="var(--text-muted)"
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          formatter={(value: number, _name, item) => [
            `${formatCurrency(value)} (${item.payload.percent.toFixed(0)}%)`,
            "Spent",
          ]}
          contentStyle={{
            background: "var(--surface-1)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 13,
          }}
        />
        <Bar dataKey="amount" fill="var(--series-1)" radius={[0, 4, 4, 0]} barSize={20} />
      </BarChart>
    </ResponsiveContainer>
  );
}
