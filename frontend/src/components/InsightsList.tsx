import type { InsightSeverity } from "../api/types";

interface Props {
  insights: { message: string; severity: InsightSeverity }[];
}

export function InsightsList({ insights }: Props) {
  if (insights.length === 0) {
    return <p className="empty-state">Add some transactions to see personalized insights.</p>;
  }

  return (
    <ul className="insight-list">
      {insights.map((insight, i) => (
        <li key={i} className="insight-item">
          <span className={`dot ${insight.severity}`} />
          <span>{insight.message}</span>
        </li>
      ))}
    </ul>
  );
}
