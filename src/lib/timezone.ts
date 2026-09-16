// Neither ShowingTime nor Supra emails include a timezone, and every
// listing is in the Seattle area, so wall-clock times from those emails
// are assumed to be America/Los_Angeles. `month` is 0-indexed (Date.UTC
// convention) so callers parsing a month name can pass its array index
// directly.
const TIMEZONE = "America/Los_Angeles";

export function pacificWallTimeToUTC(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number
): Date {
  const asIfUTC = new Date(Date.UTC(year, month, day, hour, minute));
  const laString = asIfUTC.toLocaleString("en-US", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const [datePart, timePart] = laString.split(", ");
  const [mo, d, y] = datePart.split("/").map(Number);
  const [h, mi, se] = timePart.split(":").map(Number);
  const laAsIfUTC = Date.UTC(y, mo - 1, d, h, mi, se);
  const offset = asIfUTC.getTime() - laAsIfUTC;
  return new Date(asIfUTC.getTime() + offset);
}
