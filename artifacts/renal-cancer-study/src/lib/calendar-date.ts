// The API may serialize calendar dates as either YYYY-MM-DD or ISO timestamps.
// Keep the recorded calendar day instead of converting it to the browser timezone.
export function toDateInput(value: string | Date | null | undefined): string {
  const text = value instanceof Date
    ? (Number.isNaN(value.getTime()) ? '' : value.toISOString())
    : value || '';
  const match = /^(\d{4}-\d{2}-\d{2})(?:$|T)/.exec(text);
  if (!match) return '';
  const date = new Date(`${match[1]}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === match[1]
    ? match[1]
    : '';
}

export function formatCalendarDate(value: string | Date | null | undefined): string {
  const day = toDateInput(value);
  if (!day) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${day}T00:00:00Z`));
}
