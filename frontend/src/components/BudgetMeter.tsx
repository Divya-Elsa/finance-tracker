interface Props {
  categoryName: string;
  spent: number;
  limit: number;
}

export function BudgetMeter({ categoryName, spent, limit }: Props) {
  const ratio = limit > 0 ? spent / limit : 0;
  const fillClass = ratio > 1 ? "over" : ratio > 0.85 ? "warning" : "";
  const widthPct = Math.min(ratio, 1) * 100;

  return (
    <div className="meter-row">
      <div className="meter-labels">
        <span>{categoryName}</span>
        <span>
          ${spent.toFixed(0)} / ${limit.toFixed(0)}
        </span>
      </div>
      <div className="meter-track">
        <div className={`meter-fill ${fillClass}`} style={{ width: `${widthPct}%` }} />
      </div>
    </div>
  );
}
