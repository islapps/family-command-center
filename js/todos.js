// To-do rules shared by the To-dos page and the sidebar badge.
//
// A to-do is { id, text, who, repeat, date, dueDay, dueMonth, done, doneFor, doneOn, at }:
//   repeat 'none'      - a one-off for `date` (today by default). Unfinished ones carry over to later days.
//   repeat 'weekly' | 'monthly' | 'quarterly'
//                      - checked off once per week / month / quarter. `doneFor` names the period it was
//                        checked for, so it comes back unchecked automatically when the next period starts.
//   Optional set day for repeating to-dos (stored as strings; '' means any time in the period):
//     weekly    dueDay '0'-'6' (Sunday-Saturday)
//     monthly   dueDay '1'-'28' or 'last'
//     quarterly dueMonth '0'-'2' (1st/2nd/3rd month of the quarter) + dueDay '1'-'28' or 'last'
//   doneOn: the day it was checked, so things checked today stay visible (crossed out) until tomorrow.
import { keyOf, pad, startOfWeek, addDays, daysBetween, daysInMonth, fmt, today } from './dates.js';

export const TODO_REPEATS = [
  { id: 'none', label: 'Once' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'quarterly', label: 'Quarterly' },
];
export const QUARTER_MONTHS = ['Jan, Apr, Jul, Oct', 'Feb, May, Aug, Nov', 'Mar, Jun, Sep, Dec'];

export function ordinal(n) {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th');
  return n + s;
}
const dayIn = (y, m, day) => day === 'last' ? daysInMonth(y, m) : Math.min(+day || 1, daysInMonth(y, m));
const hasDay = v => v !== undefined && v !== null && v !== '';

export function periodKey(repeat, d, weekStart) {
  if (repeat === 'weekly') return 'W' + keyOf(startOfWeek(d, weekStart));
  if (repeat === 'monthly') return 'M' + d.getFullYear() + '-' + pad(d.getMonth() + 1);
  if (repeat === 'quarterly') return 'Q' + d.getFullYear() + '-' + (Math.floor(d.getMonth() / 3) + 1);
  return '';
}

export function isDone(t, weekStart, d = today()) {
  return t.repeat === 'none' ? !!t.done : t.doneFor === periodKey(t.repeat, d, weekStart);
}

// The day a repeating to-do is due in the current period, or null if it can be done any time.
export function dueDate(t, weekStart, d = today()) {
  const y = d.getFullYear(), m = d.getMonth();
  if (t.repeat === 'weekly' && hasDay(t.dueDay)) return addDays(startOfWeek(d, weekStart), (+t.dueDay - weekStart + 7) % 7);
  if (t.repeat === 'monthly' && hasDay(t.dueDay)) return new Date(y, m, dayIn(y, m, t.dueDay));
  if (t.repeat === 'quarterly' && hasDay(t.dueMonth)) {
    const mm = Math.floor(m / 3) * 3 + +t.dueMonth;
    return new Date(y, mm, dayIn(y, mm, t.dueDay || '1'));
  }
  return null;
}

// Added after this period's set day (e.g. "on the 1st" added on the 10th)? Then it starts next period,
// instead of showing up as overdue right away. `date` is the day a repeating to-do was added.
const countsThisPeriod = (t, due) => keyOf(due) >= (t.date || '');

// "Tuesdays", "On the 1st", "On the last day", "Nov 15", or '' for any time.
export function scheduleLabel(t, weekStart, d = today()) {
  if (t.repeat === 'weekly' && hasDay(t.dueDay)) return fmt(addDays(startOfWeek(d, 0), +t.dueDay), { weekday: 'long' }) + 's';
  if (t.repeat === 'monthly' && hasDay(t.dueDay)) return t.dueDay === 'last' ? 'On the last day' : 'On the ' + ordinal(+t.dueDay);
  if (t.repeat === 'quarterly' && hasDay(t.dueMonth)) return fmt(dueDate(t, weekStart, d), { month: 'short', day: 'numeric' });
  return '';
}

// Due status for an unfinished repeating to-do: { text, cls } or null.
export function dueStatus(t, weekStart, d = today()) {
  const due = dueDate(t, weekStart, d);
  if (!due || isDone(t, weekStart, d) || !countsThisPeriod(t, due)) return null;
  const diff = daysBetween(d, due);
  if (diff === 0) return { text: 'Due today', cls: 'due' };
  if (diff < 0) return { text: 'Overdue', cls: 'late' };
  return null;
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

// Splits the list into the page's sections.
//   today    - one-offs for today or carried over, plus repeating to-dos that are due or overdue
//              (anything checked today stays, crossed out, until tomorrow); oldest first
//   upcoming - one-offs for later days
//   weekly / monthly / quarterly - every repeating to-do, set days first in date order
export function sections(todos, weekStart, d = today()) {
  const k = keyOf(d);
  const s = { today: [], upcoming: [], weekly: [], monthly: [], quarterly: [] };
  const since = new Map();
  todos.forEach(t => {
    if (t.repeat === 'none') {
      if (t.date > k) s.upcoming.push(t);
      else if (!t.done || t.date === k || t.doneOn === k) { s.today.push(t); since.set(t, t.date); }
      return;
    }
    if (!s[t.repeat]) return;
    s[t.repeat].push(t);
    const due = dueDate(t, weekStart, d);
    if (due && keyOf(due) <= k && countsThisPeriod(t, due) && (!isDone(t, weekStart, d) || t.doneOn === k)) { s.today.push(t); since.set(t, keyOf(due)); }
  });
  s.today.sort((a, b) => since.get(a).localeCompare(since.get(b)));
  s.upcoming.sort((a, b) => a.date.localeCompare(b.date));
  ['weekly', 'monthly', 'quarterly'].forEach(r => {
    const key = t => { const due = dueDate(t, weekStart, d); return due ? keyOf(due) : '9999'; };
    s[r].sort((a, b) => key(a).localeCompare(key(b)));
  });
  return s;
}

// How many still need doing now: unfinished one-offs for today or earlier, and this period's repeating ones.
export function openCount(todos, weekStart, d = today()) {
  const k = keyOf(d);
  return todos.filter(t => t.repeat === 'none' ? t.date <= k && !t.done : !!t.repeat && !isDone(t, weekStart, d)).length;
}
