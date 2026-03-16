interface RelativeTimeOptions {
  uppercase?: boolean;
}

const DEFAULT_LOCALE: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };

function formatWithCase(value: string, uppercase: boolean): string {
  return uppercase ? value.toUpperCase() : value.toLowerCase();
}

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

export function formatRelativeTime(value: string | Date, options: RelativeTimeOptions = {}): string {
  const { uppercase = true } = options;
  const date = toDate(value);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffSecs < 60) return formatWithCase('just now', uppercase);
  if (diffMins < 60) return formatWithCase(`${diffMins}m ago`, uppercase);
  if (diffHours < 24) return formatWithCase(`${diffHours}h ago`, uppercase);
  if (diffDays < 7) return formatWithCase(`${diffDays}d ago`, uppercase);
  if (diffWeeks < 4) return formatWithCase(`${diffWeeks}w ago`, uppercase);
  if (diffMonths < 12) return formatWithCase(`${diffMonths}mo ago`, uppercase);
  if (diffYears < 1) return formatWithCase(`${diffMonths}mo ago`, uppercase);
  return formatWithCase(`${diffYears}y ago`, uppercase);
}

export function formatExpiryTime(value: string | Date, options: RelativeTimeOptions = {}): string {
  const { uppercase = true } = options;
  const date = toDate(value);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMs < 0) return formatWithCase('expired', uppercase);
  if (diffMins < 60) return formatWithCase(`${diffMins}m left`, uppercase);
  if (diffHours < 24) return formatWithCase(`${diffHours}h left`, uppercase);
  if (diffDays < 7) return formatWithCase(`${diffDays}d left`, uppercase);
  return formatWithCase(date.toLocaleDateString('en-US', DEFAULT_LOCALE), uppercase);
}

export function formatShortDate(value: string | Date, options: RelativeTimeOptions = {}): string {
  const { uppercase = true } = options;
  return formatWithCase(toDate(value).toLocaleDateString('en-US', DEFAULT_LOCALE), uppercase);
}
