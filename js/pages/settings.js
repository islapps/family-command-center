// Settings: calendar preferences, data source and family sync, weather source.
import { icon } from '../icons.js';
import { esc, openModal, toast } from '../ui.js';
import {
  getPrefs, setPrefs, isSample, setSampleMode, mode, getSyncStatus, hasFamilyLink, familyLink, forgetFamilyLink,
} from '../store.js';
import { getWeather, LOCATION } from '../weather.js';

let root = null;

function seg(name, value, options) {
  return '<div class="seg" role="radiogroup" aria-label="' + esc(name) + '">' + options.map(o =>
    '<button type="button" role="radio" data-pref="' + name + '" data-value="' + o[0] + '" aria-checked="' + (String(value) === String(o[0])) + '">' + o[1] + '</button>').join('') + '</div>';
}

async function shareLink() {
  const url = familyLink();
  if (!url) return;
  if (navigator.share) {
    try { await navigator.share({ title: 'McAfee Family', url }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  try { await navigator.clipboard.writeText(url); toast('Family link copied'); }
  catch (e) { toast('Couldn’t copy the link on this device'); }
}

function confirmForget() {
  openModal({
    label: 'Remove family link from this device',
    cls: 'modal-sm',
    html:
      '<div class="modal-head"><h2>Remove from this device?</h2></div>' +
      '<div class="modal-body"><p>Your family’s data stays safe on the other devices. This one goes back to sample data. To reconnect, open the family link here again.</p></div>' +
      '<div class="modal-foot"><span></span><div class="foot-right"><button class="btn btn-quiet" data-close>Cancel</button>' +
      '<button class="btn btn-danger" data-forget>Remove</button></div></div>',
    mount(modal) { modal.querySelector('[data-forget]').addEventListener('click', forgetFamilyLink); },
  });
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
    else if (e.target.closest('[data-act="share"]')) shareLink();
    else if (e.target.closest('[data-act="forget"]')) confirmForget();
  });
  refresh();
}

function syncRow() {
  if (!hasFamilyLink()) {
    return '<div class="set-row"><div><b>Sync between devices</b><p>Not set up on this device. Open your private family link here to connect it.' +
      (mode() === 'local' ? ' Until then, anything you add is saved on this device only.' : '') + '</p></div>' +
      '<span class="status-pill">' + icon('link', 16) + 'Not connected</span></div>';
  }
  const st = getSyncStatus();
  const pill = {
    live: ['ok', 'Connected'], connecting: ['', 'Connecting…'], offline: ['', 'Offline'], error: ['warn', 'Can’t connect'],
  }[st.state] || ['', st.state];
  let note = 'This device uses your private family link, so changes show up on every device that has it. ' +
    'Anyone with the link can see and change your family’s data, so only share it with family.';
  if (st.state === 'offline') note = 'No internet right now. You can keep making changes; they’ll sync when the connection is back.';
  if (st.state === 'error') note = st.code === 'permission-denied'
    ? 'Firebase refused the connection. The family link or the database rules may not match.'
    : 'Something went wrong connecting to Firebase (' + esc(st.code) + '). Try reloading the page.';
  if (isSample()) note += ' Turn off sample data above to see your family’s data.';
  return '<div class="set-row"><div><b>Sync between devices</b><p>' + note + '</p></div>' +
      '<span class="status-pill ' + pill[0] + '">' + icon(st.state === 'live' ? 'check' : st.state === 'connecting' ? 'link' : 'wifi-off', 16) + pill[1] + '</span></div>' +
    '<div class="set-row"><div><b>Add another device</b><p>Send the link to a family member’s phone, open it there, then use Share → Add to Home Screen.</p></div>' +
      '<div class="set-actions"><button class="btn btn-quiet" data-act="share">' + icon('link', 18) + 'Share family link</button>' +
      '<button class="btn btn-danger-ghost" data-act="forget">Remove from this device</button></div></div>';
}

function refresh() {
  if (!root) return;
  const p = getPrefs(), w = getWeather(), m = mode();
  const sampleText = isSample()
    ? 'On: you’re looking at example events and lists. Changes reset when the page reloads. ' +
      (hasFamilyLink() ? 'Turn this off to see your family’s data.' : 'Turn this off to enter your own.')
    : m === 'cloud'
      ? 'Off: you’re seeing your family’s shared data. Turning this on just hides it; nothing is deleted.'
      : 'Off: you’re using your own data, saved on this device only. Turning this on hides it; nothing is deleted.';
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
      '<div class="set-row"><div><b>Show sample data</b><p>' + sampleText + '</p></div>' +
        '<button class="switch" id="sampleSwitch" role="switch" aria-checked="' + isSample() + '" aria-label="Show sample data"><i></i></button></div>' +
      syncRow() +
    '</section>' +
    '<section class="card settings-card">' +
      '<h2 class="set-title">' + icon('cloud-sun', 18) + 'Weather</h2>' +
      '<div class="set-row"><div><b>' + LOCATION + '</b><p>Live forecast from Open-Meteo, refreshed every 30 minutes.' +
        (w ? ' Last updated ' + new Date(w.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) + '.' : ' Not available right now.') + '</p></div></div>' +
    '</section>';
}

export default { mount, refresh, unmount() { root = null; } };
