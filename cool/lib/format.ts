export function truncateMiddle(value: string, start = 4, end = 3) {
  if (value.length <= start + end + 3) return value;
  return `${value.slice(0, start)}...${value.slice(-end)}`;
}

export function isValidStellarAddress(value: string) {
  return /^G[A-Z0-9]{20,}$/.test(value.trim());
}

export function relativeDate(value: string | number) {
  const diff = Date.now() - new Date(value).getTime();
  const days = Math.max(1, Math.round(diff / 86400000));
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  const months = Math.round(days / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
}

export function fullDate(value: string | number) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
