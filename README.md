# McAfee Family Command Center

A family dashboard for the kitchen iPad (landscape), with phone support: calendar, meal plan, shopping list, and notes.

Live at https://islapps.github.io/family-command-center/

## How it's built

Plain HTML, CSS, and JavaScript modules. There's no framework and no build step; GitHub Pages serves the files as they are.

```
index.html            page shell (sidebar, header, page area)
css/app.css           all styles; design tokens at the top
js/app.js             sidebar, header (date · weather · time), routing
js/store.js           the one place data is read and changed
js/events.js          member colors, repeat rules, events on a given day
js/editor.js          add / edit / delete events
js/weather.js         live Corinth, TX weather from Open-Meteo
js/sample.js          sample data for presentation mode
js/pages/*.js         Calendar, Meals, Shopping, Notes, Family, Settings
js/icons.js           Lucide icons (ISC license), inlined
```

## Data

- **Sample data** (default): example events and lists, kept in memory only. Changes reset on reload and never touch real data.
- **Your data** (turn off "Show sample data" in Settings): saved on this device only.
- **Next step:** sync through Firebase behind a private family link, so the iPad and both phones share one copy.

## Layout targets

- Landscape iPad (1024×768 and 1080×810): everything fits one screen, no page scrolling.
- Portrait iPad and narrow windows: the utility cards move below the calendar.
- Phones: bottom navigation; Week view becomes a day-by-day list.
