interface StatCardProps {
  label: string;
  value: string;
  tone?: "positive" | "negative" | "neutral";
}

export function StatCard({ label, value, tone = "neutral" }: StatCardProps) {
  const toneClass = tone === "neutral" ? "" : tone === "positive" ? "positive" : "negative";
  return (
    <div className="card stat-tile">
      <div className="label">{label}</div>
      <div className={`value ${toneClass}`}>{value}</div>
    </div>
  );
}
