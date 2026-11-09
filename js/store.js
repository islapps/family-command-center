// The single source of app data. Pages read with getData() and change things with mutate().
//
// Three modes:
//   sample - example data in memory only (the public page, or when "Show sample data" is on)
//   cloud  - this device has the private family link; data syncs through Firestore
//   local  - no family link and sample data off; saved on this device only
import { buildSample, DEFAULT_FAMILY } from './sample.js';

const DATA_KEY = 'fcc.data.v1';      // device-only data
const CLOUD_KEY = 'fcc.cloud.v1';    // last copy of family data, for an instant first screen
const PREFS_KEY = 'fcc.prefs.v1';
const FAMILY_KEY = 'fcc.family.v1';  // the private family key
const KEY_RE = /^[A-Za-z0-9]{20,64}$/;
const COLLS = ['events', 'shopping', 'notes', 'meals', 'members'];

const listeners = new Set();

function readJSON(key) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch (e) { return null; }
}
function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
}
function readText(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
function emptyData() {
  return { events: [], shopping: [], notes: [], meals: {}, family: DEFAULT_FAMILY.map(m => Object.assign({}, m)) };
}

/* ---------- Private family link ---------- */
const prefs = Object.assign({ weekStart: 0, defaultView: 'day', sample: true }, readJSON(PREFS_KEY));
// v2: the calendar now opens in Day view. Devices set up earlier saved "month" without anyone choosing it.
if (!prefs.v || prefs.v < 2) { prefs.defaultView = 'day'; prefs.v = 2; writeJSON(PREFS_KEY, prefs); }
let familyKey = null;
(function readFamilyKey() {
  const fromUrl = new URLSearchParams(location.search).get('family');
  const stored = readText(FAMILY_KEY);
  if (fromUrl && KEY_RE.test(fromUrl)) {
    familyKey = fromUrl;
    if (fromUrl !== stored) {           // first time this device opens the link: use family data
      try { localStorage.setItem(FAMILY_KEY, fromUrl); } catch (e) { /* storage blocked */ }
      prefs.sample = false;
      writeJSON(PREFS_KEY, prefs);
    }
  } else if (stored && KEY_RE.test(stored)) {
    familyKey = stored;
    // Put the key back in the address so "Add to Home Screen" keeps it
    // (home-screen apps don't share storage with Safari).
    const url = new URL(location.href);
    url.searchParams.set('family', stored);
    history.replaceState(null, '', url.pathname + url.search + url.hash);
  }
})();

export const hasFamilyLink = () => !!familyKey;
export function familyLink() {
  return familyKey ? location.origin + location.pathname + '?family=' + familyKey : null;
}
export function forgetFamilyLink() {
  try { localStorage.removeItem(FAMILY_KEY); localStorage.removeItem(CLOUD_KEY); } catch (e) { /* ignore */ }
  prefs.sample = true;
  writeJSON(PREFS_KEY, prefs);
  location.replace(location.pathname + location.hash);
}

/* ---------- Data ---------- */
export const mode = () => prefs.sample ? 'sample' : familyKey ? 'cloud' : 'local';

function loadLocal() {
  const saved = readJSON(DATA_KEY);
  return saved ? Object.assign(emptyData(), saved) : emptyData();
}
function loadCloudCache() {
  const c = readJSON(CLOUD_KEY);
  return c && c.key === familyKey ? Object.assign(emptyData(), c.data) : emptyData();
}

let cloudData = familyKey ? loadCloudCache() : null;
let data = prefs.sample ? buildSample() : familyKey ? cloudData : loadLocal();

export const getData = () => data;
export const getPrefs = () => prefs;
export const isSample = () => !!prefs.sample;

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit() { listeners.forEach(fn => fn()); }

/* ---------- Sync status ---------- */
let sync = null;          // the sync module once loaded
let syncStarted = false;
let queued = [];          // changes made before the sync module finished loading
let status = { state: 'connecting' };
const meta = {};          // per collection: { fromCache, sig }
let seededMembers = false;

export const getSyncStatus = () => status;
function updateStatus(next) {
  if (next) status = next;
  else if (status.state !== 'error') {
    const allLive = COLLS.every(c => meta[c] && meta[c].fromCache === false);
    status = { state: allLive ? 'live' : navigator.onLine === false ? 'offline' : 'connecting' };
  }
}

// One string per document, so a change can be turned into exact document writes.
function serialize(d) {
  const byId = arr => {
    const o = {};
    arr.forEach(x => { const c = Object.assign({}, x); delete c.id; o[x.id] = JSON.stringify(c); });
    return o;
  };
  const meals = {};
  Object.keys(d.meals).forEach(k => { meals[k] = JSON.stringify({ name: d.meals[k] }); });
  const members = {};
  d.family.forEach((m, i) => { const c = Object.assign({}, m, { order: i }); delete c.id; members[m.id] = JSON.stringify(c); });
  return { events: byId(d.events), shopping: byId(d.shopping), notes: byId(d.notes), meals, members };
}
function diff(before, after) {
  const changes = [];
  COLLS.forEach(coll => {
    const a = before[coll], b = after[coll];
    Object.keys(b).forEach(id => { if (a[id] !== b[id]) changes.push({ coll, id, data: JSON.parse(b[id]) }); });
    Object.keys(a).forEach(id => { if (!(id in b)) changes.push({ coll, id, data: null }); });
  });
  return changes;
}
function send(changes) {
  if (!changes.length) return;
  if (sync) sync.write(changes); else queued = queued.concat(changes);
}
function saveCloudCache() { writeJSON(CLOUD_KEY, { key: familyKey, data: cloudData }); }

function onCollection(name, docs, m) {
  const sig = JSON.stringify(docs);
  const changed = !meta[name] || meta[name].sig !== sig;
  meta[name] = { fromCache: m.fromCache, sig };
  if (changed) {
    if (name === 'meals') {
      const meals = {};
      docs.forEach(d => { if (d.name) meals[d.id] = d.name; });
      cloudData.meals = meals;
    } else if (name === 'members') {
      if (docs.length) {
        cloudData.family = docs.sort((a, b) => (a.order || 0) - (b.order || 0))
          .map(d => { const c = Object.assign({}, d); delete c.order; return c; });
      }
    } else {
      const sorted = name === 'events' ? docs : docs.sort((a, b) => (b.at || 0) - (a.at || 0)); // newest first
      cloudData[name] = sorted;
    }
    saveCloudCache();
  }
  // Brand-new family: the server confirms there are no members yet, so save the defaults once.
  // (Checked on every snapshot: "empty from cache" then "empty from server" is not a data change.)
  if (name === 'members' && !docs.length && !m.fromCache && !seededMembers) {
    seededMembers = true;
    send(diff(serialize(Object.assign(emptyData(), { family: [] })), serialize(emptyData())));
  }
  const prev = status.state;
  updateStatus();
  if (changed || prev !== status.state) emit();
}

async function startCloud() {
  if (syncStarted || !familyKey) return;
  syncStarted = true;
  window.addEventListener('online', () => { updateStatus(); emit(); });
  window.addEventListener('offline', () => { updateStatus(); emit(); });
  try {
    const mod = await import('./sync.js');
    await mod.connect(familyKey, { onCollection, onStatus: s => { updateStatus(s); emit(); } });
    sync = mod;
    if (queued.length) { const q = queued; queued = []; sync.write(q); }
  } catch (e) {
    updateStatus({ state: 'error', code: 'load-failed' });
    emit();
  }
}
if (mode() === 'cloud') startCloud();

/* ---------- Changing data ---------- */
// Change data in place, then save (device mode) or sync (family mode), and notify the pages.
export function mutate(fn) {
  const m = mode();
  if (m !== 'cloud') {
    fn(data);
    if (m === 'local') writeJSON(DATA_KEY, data);
    emit();
    return;
  }
  const before = serialize(data);
  fn(data);
  const changes = diff(before, serialize(data));
  saveCloudCache();
  emit();
  send(changes);
}

// Copy of one part of the data, for Undo.
export function snapshot(part) { return JSON.parse(JSON.stringify(data[part])); }
export function restore(part, value) { mutate(d => { d[part] = value; }); }

export function setPrefs(patch) {
  Object.assign(prefs, patch);
  writeJSON(PREFS_KEY, prefs);
  emit();
}

export function setSampleMode(on) {
  prefs.sample = !!on;
  writeJSON(PREFS_KEY, prefs);
  if (prefs.sample) data = buildSample();
  else if (familyKey) { data = cloudData; startCloud(); }
  else data = loadLocal();
  emit();
}

export function uid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}
