# McAfee Family — dashboard mockup

A clickable mockup of the family dashboard: calendar, week ahead, weather, shopping list, meal plan, and notes.

Live at https://islapps.github.io/family-command-center/

- Everything lives in `index.html` (HTML, CSS, and JavaScript in one file, no build step).
- **Phone** (under 768px wide): one scrolling page with a sticky shortcut bar.
- **iPad** (768px and wider): a full-screen dashboard. A left column always shows the clock, weather, today's schedule, and tonight's dinner. The right side has tabs for Calendar, Week Ahead, Shopping, Meals, and Notes. In portrait, the glance column becomes a strip across the top.
- All data is fake. Events are generated relative to today's date, so the calendar always looks current. On an always-on iPad, the page reloads itself after midnight so "today" stays correct.
- Adding, checking, and editing work in the moment. Nothing is saved; a refresh resets it.
