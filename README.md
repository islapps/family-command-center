# McAfee Family Command Center

A family dashboard for the kitchen iPad (landscape), with phone support: calendar, meal plan, shopping list, and notes.

Live at https://islapps.github.io/family-command-center/ (the plain address shows sample data; the family uses a private link).

## How it's built

Plain HTML, CSS, and JavaScript modules. There's no framework and no build step; GitHub Pages serves the files as they are.

```
index.html               page shell (sidebar, header, page area)
css/app.css              all styles; design tokens at the top
js/app.js                sidebar, header (date · weather · time), routing
js/store.js              the one place data is read and changed; sample / device / family modes
js/sync.js               family sync through Cloud Firestore (loaded only with the family link)
js/firebase-config.js    public Firebase web config
js/vendor/firebase.js    Firebase SDK v12.19.0 (app + firestore), bundled once with esbuild
js/events.js             member colors, repeat rules, events on a given day
js/editor.js             add / edit / delete events
js/weather.js            live Corinth, TX weather from Open-Meteo
js/sample.js             sample data for presentation mode
js/pages/*.js            Calendar, Meals, Shopping, Notes, Family, Settings
js/icons.js              Lucide icons (ISC license), inlined
firestore.rules.example  security rules template (the real key is never committed)
```

## Data and sync

- **Sample data**: the public page, or "Show sample data" in Settings. In memory only; never touches real data.
- **Family data**: opening the private family link (`?family=KEY`) connects a device to Firestore at
  `families/KEY/{events,shopping,notes,meals,members}`. Changes sync live between devices, and each device keeps
  an offline copy. The key stays in the address so "Add to Home Screen" keeps it.
- **Device only**: sample data off and no family link; saved in this browser.
- **Security**: the Firestore rules (set in the Firebase console, not in this repo) only allow the family key's
  space. Anyone with the family link can read and change the family's data, so share it only with family.

## Rebuilding the Firebase bundle

```
npm install firebase@12.19.0 esbuild
# entry.js re-exports: initializeApp, initializeFirestore, getFirestore, persistentLocalCache,
# persistentMultipleTabManager, memoryLocalCache, collection, doc, onSnapshot, writeBatch
npx esbuild entry.js --bundle --format=esm --minify --target=es2020,safari15 --outfile=js/vendor/firebase.js
```

## Layout targets

- Landscape iPad (1024×768 and 1080×810): everything fits one screen, no page scrolling.
- Portrait iPad and narrow windows: the utility cards move below the calendar.
- Phones: bottom navigation; Week view becomes a day-by-day list.
