// Settings: calendar preferences, sample data, weather source.
import { icon } from '../icons.js';
import { $, esc } from '../ui.js';
import { getPrefs, setPrefs, isSample, setSampleMode } from '../store.js';
import { getWeather, LOCATION } from '../weather.js';

let root = null;

function seg(name, value, options) {
  return '<div class="seg" role="radiogroup" aria-label="' + esc(name) + '">' + options.map(o =>
    '<button type="button" role="radio" data-pref="' + name + '" data-value="' + o[0] + '" aria-checked="' + (String(value) === String(o[0])) + '">' + o[1] + '</button>').join('') + '</div>';
}

function mount(el) {
  root = el;
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-pref]');
    if (b) {
      const v = b.dataset.value;
      setPrefs({ [b.dataset.pref]: b.dataset.pref === 'weekStart' ? +v : v });
      return;
    }
    if (e.target.closest('#sampleSwitch')) setSampleMode(!isSample());
  });
  refresh();
}

function refresh() {
  if (!root) return;
  const p = getPrefs(), w = getWeather();
  root.innerHTML =
    '<div class="page-head"><div><h1>Settings</h1><p>These settings apply to this device.</p></div></div>' +
    '<section class="card settings-card">' +
      '<h2 class="set-title">' + icon('calendar', 18) + 'Calendar</h2>' +
      '<div class="set-row"><div><b>Week starts on</b><p>Used by the calendar and the meal plan.</p></div>' +
        seg('weekStart', p.weekStart, [[0, 'Sunday'], [1, 'Monday']]) + '</div>' +
      '<div class="set-row"><div><b>Opens in</b><p>The view the calendar shows first.</p></div>' +
        seg('defaultView', p.defaultView, [['month', 'Month'], ['week', 'Week'], ['day', 'Day']]) + '</div>' +
    '</section>' +
    '<section class="card settings-card">' +
      '<h2 class="set-title">' + icon('info', 18) + 'Data</h2>' +
      '<div class="set-row"><div><b>Show sample data</b><p>' + (isSample()
        ? 'On: you’re looking at example events and lists. Changes reset when the page reloads. Turn this off to start entering your own.'
        : 'Off: you’re using your own data. Turning this on hides it until you turn it off again; nothing is deleted.') + '</p></div>' +
        '<button class="switch" id="sampleSwitch" role="switch" aria-checked="' + isSample() + '" aria-label="Show sample data"><i></i></button></div>' +
      '<div class="set-row"><div><b>Sync between devices</b><p>Not set up yet. For now, your own data is saved on this device only. The private family link is the next step.</p></div>' +
        '<span class="status-pill">' + icon('link', 16) + 'Not connected</span></div>' +
    '</section>' +
    '<section class="card settings-card">' +
      '<h2 class="set-title">' + icon('cloud-sun', 18) + 'Weather</h2>' +
      '<div class="set-row"><div><b>' + LOCATION + '</b><p>Live forecast from Open-Meteo, refreshed every 30 minutes.' +
        (w ? ' Last updated ' + new Date(w.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) + '.' : ' Not available right now.') + '</p></div></div>' +
    '</section>';
}

export default { mount, refresh, unmount() { root = null; } };
