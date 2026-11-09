// Date helpers. Dates are local-time Date objects at midnight; "keys" are 'YYYY-MM-DD' strings.

export const pad = n => String(n).padStart(2, '0');
export const keyOf = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
export const parseKey = k => { const p = k.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); };
export const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const today = () => startOfDay(new Date());
export const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const sameDay = (a, b) => !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
export const daysBetween = (a, b) => Math.round((startOfDay(b) - startOfDay(a)) / 864e5);
export const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
export const startOfWeek = (d, weekStart) => addDays(d, -((d.getDay() - weekStart + 7) % 7));
export const fmt = (d, o) => d.toLocaleDateString('en-US', o);

export function addMonths(d, n) {
  const t = new Date(d.getFullYear(), d.getMonth() + n, 1);
  t.setDate(Math.min(d.getDate(), daysInMonth(t.getFullYear(), t.getMonth())));
  return t;
}

export const toMin = hm => { const p = hm.split(':').map(Number); return p[0] * 60 + p[1]; };
export const fromMin = m => { m = Math.max(0, Math.min(m, 24 * 60 - 1)); return pad(Math.floor(m / 60)) + ':' + pad(m % 60); };
export const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };

// '14:30' -> '2:30 PM'
export function timeLabel(hm) {
  const p = hm.split(':').map(Number);
  return (p[0] % 12 || 12) + ':' + pad(p[1]) + ' ' + (p[0] >= 12 ? 'PM' : 'AM');
}
// 7 -> '7 AM'
export const hourLabel = h => (h % 12 || 12) + ' ' + (h >= 12 && h < 24 ? 'PM' : 'AM');

// 'Today' / 'Tomorrow' / 'Yesterday', otherwise null
export function relDay(d) {
  const n = daysBetween(today(), d);
  return n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : n === -1 ? 'Yesterday' : null;
}

export function weekRangeLabel(start) {
  const end = addDays(start, 6);
  const sameMonth = start.getMonth() === end.getMonth();
  const sameYear = start.getFullYear() === end.getFullYear();
  const a = fmt(start, sameYear ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' });
  const b = fmt(end, sameMonth ? { day: 'numeric' } : { month: 'short', day: 'numeric' });
  return a + ' – ' + b + ', ' + end.getFullYear();
}
