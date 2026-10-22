const stamp = (value: string) =>
  new Date(value.length === 10 ? value + "T00:00:00+06:30" : value);
export function schoolDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Yangon",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(stamp(value));
}
export function periodLabel(from: string, to: string) {
  const format = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Yangon",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  return format.formatRange(stamp(from), stamp(to));
}
export function weekPeriod(today: string, offset = 0) {
  const start = new Date(today + "T12:00:00Z");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(today) ||
    !Number.isFinite(start.valueOf()) ||
    start.toISOString().slice(0, 10) !== today
  )
    throw Error("INVALID_DATE");
  start.setUTCDate(
    start.getUTCDate() - ((start.getUTCDay() + 6) % 7) + offset * 7,
  );
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}
