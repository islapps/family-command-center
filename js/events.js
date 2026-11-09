// Calendar logic: member colors, repeat rules, and finding the events on a given day.
import { keyOf, parseKey, daysBetween } from './dates.js';

// Each member color is a pair: a stronger "dot" and a pastel "soft" chip background.
export const PALETTE = {
  clay:     { name: 'Clay',     dot: '#927052', soft: '#E9DDD0' },
  sage:     { name: 'Sage',     dot: '#83977C', soft: '#E4EBDD' },
  rose:     { name: 'Rose',     dot: '#C98A84', soft: '#F1E0DC' },
  blue:     { name: 'Blue',     dot: '#7FA3BF', soft: '#DFEAF1' },
  sand:     { name: 'Sand',     dot: '#C4A27C', soft: '#F2E6D7' },
  lavender: { name: 'Lavender', dot: '#9A8DB8', soft: '#E9E5F2' },
  peach:    { name: 'Peach',    dot: '#D3956A', soft: '#F7E4D6' },
  teal:     { name: 'Teal',     dot: '#6E9C98', soft: '#DCEAE8' },
};

export const REPEATS = [
  { id: 'none', label: 'Doesn’t repeat' },
  { id: 'weekly', label: 'Every week' },
  { id: 'biweekly', label: 'Every 2 weeks' },
  { id: 'monthly', label: 'Every month' },
  { id: 'yearly', label: 'Every year' },
];

export function member(data, id) {
  return data.family.find(m => m.id === id) || data.family[0];
}
export function colorOf(data, id) {
  return PALETTE[member(data, id).color] || PALETTE.clay;
}
export function whoNames(data, who) {
  return who.map(id => member(data, id).name).join(' & ');
}
// Inline CSS variables for an event chip: first person's colors, plus a second dot for shared events.
export function chipStyle(data, ev) {
  const a = colorOf(data, ev.who[0]);
  return '--dot:' + a.dot + ';--soft:' + a.soft;
}
export function dotsHTML(data, ev) {
  return ev.who.slice(0, 2).map(id => '<i style="background:' + colorOf(data, id).dot + '"></i>').join('');
}

// How many days one occurrence covers (1 for a normal event).
export function spanDays(ev) {
  if (!ev.endDate || ev.endDate <= ev.date) return 1;
  return daysBetween(parseKey(ev.date), parseKey(ev.endDate)) + 1;
}

// Does an occurrence of this event START on day d? (Repeat rules apply to start dates.)
export function startsOn(ev, d) {
  const start = parseKey(ev.date);
  const diff = daysBetween(start, d);
  if (diff < 0) return false;
  const k = keyOf(d);
  if (ev.until && k > ev.until) return false;
  if (ev.skip && ev.skip.indexOf(k) !== -1) return false;
  switch (ev.repeat) {
    case 'weekly': return diff % 7 === 0;
    case 'biweekly': return diff % 14 === 0;
    case 'monthly': return d.getDate() === start.getDate();
    case 'yearly': return d.getDate() === start.getDate() && d.getMonth() === start.getMonth();
    default: return diff === 0;
  }
}

// The occurrence covering day d, if any: { start, index (0 = first day), span }.
export function occurrenceOn(ev, d) {
  const span = spanDays(ev);
  for (let i = 0; i < span; i++) {
    const s = new Date(d.getFullYear(), d.getMonth(), d.getDate() - i);
    if (startsOn(ev, s)) return { start: s, index: i, span };
  }
  return null;
}

// Shown at the top of a day: all-day events, and multi-day events on any day but a timed first day.
export const isTopOfDay = e => e.allDay || (e.span > 1 && e.dayIndex > 0);

export function byTime(a, b) {
  const ta = isTopOfDay(a), tb = isTopOfDay(b);
  if (ta !== tb) return ta ? -1 : 1;
  if (ta) {
    // Multi-day first (earliest start, then longest) so they line up across days; then by title.
    if ((a.span > 1) !== (b.span > 1)) return a.span > 1 ? -1 : 1;
    return (a.occ || '').localeCompare(b.occ || '') || (b.span - a.span) || a.title.localeCompare(b.title);
  }
  return a.start.localeCompare(b.start) || a.title.localeCompare(b.title);
}

// Occurrences covering day d. Each carries:
//   on       - the day's key (which day was tapped)
//   occ      - the key of the occurrence's first day (for "delete only this one")
//   dayIndex - 0 on the first day; span - number of days
export function eventsOn(data, d) {
  const k = keyOf(d);
  const out = [];
  data.events.forEach(e => {
    const o = occurrenceOn(e, d);
    if (o) out.push(Object.assign({}, e, { on: k, occ: keyOf(o.start), dayIndex: o.index, span: o.span }));
  });
  return out.sort(byTime);
}

// What to show as the "time" of an occurrence on its day.
export function whenLabel(e, timeLabel) {
  if (e.allDay) return 'All day';
  if (e.span > 1) {
    if (e.dayIndex === 0) return timeLabel(e.start);
    if (e.dayIndex === e.span - 1) return 'Until ' + timeLabel(e.end);
    return 'All day';
  }
  return timeLabel(e.start);
}
export const dayOfLabel = e => e.span > 1 ? 'Day ' + (e.dayIndex + 1) + ' of ' + e.span : '';
