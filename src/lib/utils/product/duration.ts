/** Convert numeric value + unit into a friendly string.
 * Examples:
 *   formatDuration(48, 'hours') => '2 days'
 *   formatDuration(49, 'hours') => '2 days 1 hour'
 *   formatDuration(3, 'days') => '3 days'
 *   formatDuration(36, 'hours') when unit='hours' => '1 day 12 hours'
 */
export function formatDuration(value: number | string | undefined | null, unit?: string) {
  if (value == null) return "unknown duration";

  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);

  const u = String(unit ?? "").toLowerCase().trim();

  if (u === "km") return `${n} km`;

  // normalize unit to hours or days
  if (u.startsWith("d")) {
    // value is days
    const days = Math.floor(n);
    const hours = Math.round((n - days) * 24);
    if (hours === 0) return `${days} ${days === 1 ? "day" : "days"}`;
    return `${days} ${days === 1 ? "day" : "days"} ${hours} ${hours === 1 ? "hour" : "hours"}`;
  }

  // treat everything else as hours
  const totalMinutes = Math.round(n * 60);
  if (totalMinutes < 60) return `${totalMinutes} ${totalMinutes === 1 ? "minute" : "minutes"}`;

  const days = Math.floor(totalMinutes / (24 * 60));
  const remainingMinutes = totalMinutes % (24 * 60);
  const hours = Math.floor(remainingMinutes / 60);
  const mins = remainingMinutes % 60;

  let parts = [];
  if (days > 0) parts.push(`${days} ${days === 1 ? "day" : "days"}`);
  if (hours > 0) parts.push(`${hours} ${hours === 1 ? "hour" : "hours"}`);
  if (mins > 0) parts.push(`${mins} ${mins === 1 ? "minute" : "minutes"}`);

  if (parts.length === 0) return "less than a minute";
  return parts.join(" ");
}
