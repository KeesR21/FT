export function FinanceMetricCard({
  label,
  value,
  hint,
  tone = "neutral"
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "income" | "expense" | "warn";
}) {
  return (
    <div className={`finance-metric finance-metric--${tone}`}>
      <p className="finance-metric__label">{label}</p>
      <p className="finance-metric__value">{value}</p>
      {hint ? <p className="finance-metric__hint">{hint}</p> : null}
    </div>
  );
}
