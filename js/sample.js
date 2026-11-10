// Sample data for presentation mode. Built relative to today so it always looks current.
// It lives only in memory and is never written to storage.
import { today, addDays, keyOf } from './dates.js';

export const DEFAULT_FAMILY = [
  { id: 'family', name: 'Family', color: 'clay', group: true },
  { id: 'rob', name: 'Rob', color: 'sage' },
  { id: 'hannah', name: 'Hannah', color: 'rose' },
  { id: 'kai', name: 'Kai', color: 'blue' },
  { id: 'knox', name: 'Knox', color: 'sand' },
];

export function buildSample() {
  const T = today();
  const NOW = Date.now();
  const MIN = 60000;
  let n = 0;
  const id = p => 's-' + p + '-' + (++n);
  const K = off => keyOf(addDays(T, off));
  // A start date a few weeks back on the given weekday, so repeating events already "began".
  const since = dow => keyOf(addDays(T, -(((T.getDay() - dow) + 7) % 7) - 28));
  const next = (dow, min) => { for (let i = min; i < min + 7; i++) if (addDays(T, i).getDay() === dow) return i; return min; };
  const checkup = next(2, 1);   // next Tuesday
  const dateNight = next(5, 0); // this Friday

  // Thanksgiving: fourth Thursday of November this year
  const nov1 = new Date(T.getFullYear(), 10, 1);
  const thanksgiving = keyOf(new Date(T.getFullYear(), 10, 1 + ((4 - nov1.getDay() + 7) % 7) + 21));

  const ev = (o) => Object.assign({ id: id('ev'), allDay: false, where: '', notes: '', repeat: 'none' }, o);
  const events = [
    ev({ title: 'Church', date: since(0), start: '10:30', end: '12:00', who: ['family'], where: 'Grace Fellowship', repeat: 'weekly' }),
    ev({ title: 'Sales team', date: since(1), start: '08:30', end: '09:15', who: ['rob'], where: 'Zoom', repeat: 'weekly' }),
    ev({ title: 'Soccer practice', date: since(2), start: '17:30', end: '18:30', who: ['kai'], where: 'Corinth Community Park', repeat: 'weekly' }),
    ev({ title: 'Team check-in', date: since(4), start: '10:00', end: '10:45', who: ['hannah'], where: 'Video call', repeat: 'biweekly' }),
    ev({ title: 'Soccer game', date: since(6), start: '09:00', end: '10:30', who: ['kai'], where: 'Field 3 · Community Park', repeat: 'weekly' }),
    ev({ title: 'Book club', date: K(-20), start: '19:00', end: '21:00', who: ['hannah'], where: "Jess's house", repeat: 'monthly' }),
    ev({ title: 'Daycare tour', date: K(-11), start: '09:00', end: '10:00', who: ['knox'], where: 'Little Oaks Academy' }),
    ev({ title: 'Family photos', date: K(-8), start: '16:30', end: '17:30', who: ['family'], where: 'Lewisville Lake Park' }),
    ev({ title: 'Team lunch', date: K(-5), start: '11:30', end: '13:00', who: ['rob'], where: 'Office' }),
    ev({ title: 'Dinner w/ friends', date: K(-2), start: '18:00', end: '20:00', who: ['family'], where: 'The Parkers' }),
    ev({ title: 'Grocery pickup', date: K(0), start: '16:00', end: '16:30', who: ['hannah'], where: 'Target' }),
    ev({ title: 'Picture day', date: K(1), allDay: true, who: ['kai'], where: 'Blue sweater' }),
    ev({ title: 'Client lunch', date: K(2), start: '12:00', end: '13:30', who: ['rob'], where: 'Downtown Denton' }),
    ev({ title: '6-month checkup', date: K(checkup), start: '09:15', end: '10:00', who: ['knox'], where: 'Dr. Patel · Corinth Pediatrics' }),
    ev({ title: 'Coffee w/ Jess', date: K(4), start: '09:30', end: '10:30', who: ['hannah'], where: 'Main Street' }),
    ev({ title: 'Agency pipeline', date: K(5), start: '15:00', end: '16:00', who: ['rob'], where: 'Office' }),
    ev({ title: 'Date night', date: K(dateNight), start: '19:00', end: '22:00', who: ['rob', 'hannah'], where: 'Grandma has the boys' }),
    ev({ title: "Eli's birthday party", date: K(6), start: '14:00', end: '16:00', who: ['kai'], where: 'Trampoline park' }),
    ev({ title: 'Haircut', date: K(9), start: '13:00', end: '14:00', who: ['hannah'], where: 'Salon on Main' }),
    ev({ title: 'Sales conference', date: K(12), endDate: K(14), allDay: true, who: ['rob'], where: 'Nashville' }),
    ev({ title: 'Grandparents visit', date: K(17), endDate: K(20), allDay: true, who: ['family'], where: 'Staying with us' }),
    ev({ title: 'Flu shots', date: K(16), start: '10:00', end: '10:30', who: ['kai', 'knox'], where: 'Corinth Pediatrics' }),
    ev({ title: 'Parent-teacher', date: K(19), start: '18:30', end: '19:00', who: ['kai'], where: "Kai's school" }),
    ev({ title: 'Thanksgiving', date: thanksgiving, start: '14:00', end: '18:00', who: ['family'], where: 'Our house · 12 guests' }),
  ];

  const shopping = [
    ['Diapers', 'Size 3', false], ['Whole milk', '2 gallons', false], ['Chicken thighs', 'For tacos', false],
    ['Tortillas', '', false], ['Bananas', '', false], ['Coffee beans', '', true], ['Baby wipes', '', false],
    ['Goldfish crackers', '', false], ['Sweet potatoes', '', true],
  ].map((r, i) => ({ id: id('sh'), name: r[0], note: r[1], done: r[2], at: NOW - (i + 1) * 3600e3 }));

  const yesterday8pm = addDays(T, -1).getTime() + (20 * 60 + 14) * MIN;
  const notes = [
    { id: id('nt'), by: 'hannah', at: NOW - 25 * MIN, done: false,
      text: "Knox's checkup is " + addDays(T, checkup).toLocaleDateString('en-US', { weekday: 'long' }) + ' at 9:15. Bring his shot record.' },
    { id: id('nt'), by: 'rob', at: NOW - 192 * MIN, done: false, text: 'Water bill is due Friday. Autopay is off this month.' },
    { id: id('nt'), by: 'hannah', at: yesterday8pm, done: true, text: 'Kai needs a white shirt for the school program.' },
  ];

  // Dinners for this week (both Sunday- and Monday-start weeks are covered).
  const sunday = addDays(T, -T.getDay());
  const dinners = ['Pot roast & carrots', 'Chicken tacos', 'Spaghetti & meatballs', 'Sheet-pan salmon & green beans',
    'Breakfast for dinner', 'Date night · boys get mac & cheese', 'Homemade pizza', 'Slow-cooker chili'];
  const meals = {};
  dinners.forEach((m, i) => { meals[keyOf(addDays(sunday, i))] = m; });

  // To-dos: a few for today (one carried over from yesterday), one ahead, and some repeating chores.
  const todo = (o, i) => Object.assign({ id: id('td'), who: 'family', repeat: 'none', date: K(0), done: false, doneFor: '', at: NOW - (40 - i) * 60000 }, o);
  const weekKey = 'W' + keyOf(addDays(T, -T.getDay()));
  const todos = [
    { text: "Schedule Knox's photos", who: 'hannah', date: K(-1) },
    { text: 'Return library books', who: 'kai' },
    { text: 'Call about the water bill', who: 'rob' },
    { text: 'Pick up dry cleaning', who: 'rob', done: true },
    { text: 'Buy the Thanksgiving turkey', who: 'hannah', date: K(9) },
    { text: 'Take out trash & recycling', who: 'rob', repeat: 'weekly', doneFor: weekKey },
    { text: 'Laundry & fold', who: 'hannah', repeat: 'weekly' },
    { text: 'Water the plants', who: 'kai', repeat: 'weekly' },
    { text: 'Pay the credit card', who: 'rob', repeat: 'monthly' },
    { text: 'Clean out the fridge', repeat: 'monthly' },
    { text: 'Change the air filter', who: 'rob', repeat: 'quarterly' },
    { text: 'Test smoke detectors', repeat: 'quarterly' },
  ].map(todo);

  return { events, shopping, notes, meals, todos, family: DEFAULT_FAMILY.map(m => Object.assign({}, m)) };
}
