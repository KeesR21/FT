type Props = {
  dateLabel: string;
};

export function UpdatedOnLine({ dateLabel }: Props) {
  if (!dateLabel || dateLabel === "—") return null;
  return (
    <p className="ws-updated-on">
      Updated on: <strong>{dateLabel}</strong>
    </p>
  );
}
