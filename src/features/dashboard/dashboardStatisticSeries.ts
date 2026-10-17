const dateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' });
const clockFormatter = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

function minuteOfDay(value: unknown, day: string): number | null {
  if (typeof value === 'string' && /^\d{2}:\d{2}(:\d{2})?$/.test(value)) {
    const [h, m, s = 0] = value.split(':').map(Number);
    return h < 24 && m < 60 && s < 60 ? h * 60 + m : null;
  }
  let date: Date | null = null;
  try {
    if (value instanceof Date) date = value;
    else if (typeof value === 'string' && /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)) date = new Date(value);
    else if (value && typeof value === 'object') {
      const stamp = value as { toDate?: () => Date; seconds?: number };
      if (typeof stamp.toDate === 'function') date = stamp.toDate();
      else if (typeof stamp.seconds === 'number') date = new Date(stamp.seconds * 1000);
    }
    if (!date || !Number.isFinite(date.getTime()) || dateFormatter.format(date) !== day) return null;
    const [h, m] = clockFormatter.format(date).split(':').map(Number);
    return h * 60 + m;
  } catch { return null; }
}

/** Seven cumulative points from real clock values. Missing times never create a fake trend. */
export function buildDailyStatisticSeries(values: unknown[], day: string, planned = false, now = new Date()): number[] | null {
  if (!values.length) return Array(7).fill(0);
  const minutes = values.map(value => minuteOfDay(value, day));
  if (minutes.some(value => value === null)) return null;
  const times = minutes as number[];
  const [h, m] = clockFormatter.format(now).split(':').map(Number);
  const end = planned ? 1440 : Math.max(1, h * 60 + m, times.reduce((max, value) => Math.max(max, value), 0));
  return Array.from({ length: 7 }, (_, i) => times.filter(time => time <= end * i / 6).length);
}
