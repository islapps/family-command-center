// To-do rules shared by the To-dos page and the sidebar badge.
//
// A to-do is { id, text, who, repeat, date, done, doneFor, at }:
//   repeat 'none'      - a one-off for `date` (today by default). Unfinished ones carry over to later days.
//   repeat 'weekly' | 'monthly' | 'quarterly'
//                      - checked off once per week / month / quarter. `doneFor` names the period it was
//                        checked for, so it comes back unchecked automatically when the next period starts.
import { keyOf, pad, startOfWeek, addDays, fmt, today } from './dates.js';

export const TODO_REPEATS = [
  { id: 'none', label: 'Once' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'quarterly', label: 'Quarterly' },
];

export function periodKey(repeat, d, weekStart) {
  if (repeat === 'weekly') return 'W' + keyOf(startOfWeek(d, weekStart));
  if (repeat === 'monthly') return 'M' + d.getFullYear() + '-' + pad(d.getMonth() + 1);
  if (repeat === 'quarterly') return 'Q' + d.getFullYear() + '-' + (Math.floor(d.getMonth() / 3) + 1);
  return '';
}

export function isDone(t, weekStart, d = today()) {
  return t.repeat === 'none' ? !!t.done : t.doneFor === periodKey(t.repeat, d, weekStart);
}

// When the current period ends and the item comes back, e.g. "Resets Sunday", "Resets Dec 1".
export function resetLabel(repeat, weekStart, d = today()) {
  if (repeat === 'weekly') return 'Resets ' + fmt(addDays(startOfWeek(d, weekStart), 7), { weekday: 'long' });
  if (repeat === 'monthly') return 'Resets ' + fmt(new Date(d.getFullYear(), d.getMonth() + 1, 1), { month: 'short', day: 'numeric' });
  if (repeat === 'quarterly') {
    const q = Math.floor(d.getMonth() / 3);
    const first = new Date(d.getFullYear(), q * 3, 1), last = new Date(d.getFullYear(), q * 3 + 2, 1);
    return fmt(first, { month: 'short' }) + '–' + fmt(last, { month: 'short' }) + ' · resets ' +
      fmt(new Date(d.getFullYear(), q * 3 + 3, 1), { month: 'short', day: 'numeric' });
  }
  return '';
}

// Splits the list into the page's sections, keeping the order items were added.
export function sections(todos, weekStart, d = today()) {
  const k = keyOf(d);
  const s = { today: [], upcoming: [], weekly: [], monthly: [], quarterly: [] };
  todos.forEach(t => {
    if (t.repeat === 'none') {
      if (t.date > k) s.upcoming.push(t);
      else if (!t.done || t.date === k) s.today.push(t); // overdue ones carry over; finished old ones drop off
    } else if (s[t.repeat]) s[t.repeat].push(t);
  });
  s.upcoming.sort((a, b) => a.date.localeCompare(b.date));
  return s;
}

// How many still need doing now (today's + overdue + this period's repeating ones).
export function openCount(todos, weekStart, d = today()) {
  const s = sections(todos, weekStart, d);
  return ['today', 'weekly', 'monthly', 'quarterly'].reduce((n, key) => n + s[key].filter(t => !isDone(t, weekStart, d)).length, 0);
}
