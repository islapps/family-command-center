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

export function occursOn(ev, d) {
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

export function byTime(a, b) {
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
  if (a.allDay) return a.title.localeCompare(b.title);
  return a.start.localeCompare(b.start) || a.title.localeCompare(b.title);
}

// Occurrences on day d; each carries `on` (its date key) so edits know which day was tapped.
export function eventsOn(data, d) {
  const k = keyOf(d);
  return data.events.filter(e => occursOn(e, d)).map(e => Object.assign({}, e, { on: k })).sort(byTime);
}
