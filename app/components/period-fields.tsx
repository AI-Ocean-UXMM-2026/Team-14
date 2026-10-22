"use client";
import { weekPeriod } from "@/lib/domain/display";
export default function PeriodFields({
  start,
  end,
  today,
  onChange,
  startName = "start",
  endName = "end",
}: {
  start: string;
  end: string;
  today: string;
  onChange: (start: string, end: string) => void;
  startName?: string;
  endName?: string;
}) {
  const current = weekPeriod(today),
    previous = weekPeriod(today, -1);
  return (
    <>
      <div
        className="period-shortcuts"
        role="group"
        aria-label="Payroll date shortcuts"
      >
        {[
          [current, "This week"],
          [previous, "Last week"],
        ].map(([range, label]) => {
          const dates = range as typeof current;
          return (
            <button
              className="btn small"
              type="button"
              key={String(label)}
              aria-pressed={start === dates.start && end === dates.end}
              onClick={() => onChange(dates.start, dates.end)}
            >
              {String(label)}
            </button>
          );
        })}
        <span className="record-note">Asia/Yangon · end date included</span>
      </div>
      <label className="inline-filter">
        Period start
        <input
          name={startName}
          type="date"
          value={start}
          onChange={(e) => onChange(e.target.value, end)}
          required
        />
      </label>
      <label className="inline-filter">
        Period end
        <input
          name={endName}
          type="date"
          value={end}
          onChange={(e) => onChange(start, e.target.value)}
          required
        />
      </label>
    </>
  );
}
