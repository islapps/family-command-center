// The single source of app data. Pages read with getData() and change things with mutate().
// Today: sample mode keeps data in memory only; real mode saves to this device (localStorage).
// Next step: real mode will sync through Firebase so every device shares one copy.
import { buildSample, DEFAULT_FAMILY } from './sample.js';

const DATA_KEY = 'fcc.data.v1';
const PREFS_KEY = 'fcc.prefs.v1';
const listeners = new Set();

function readJSON(key) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch (e) { return null; }
}
function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
}
function emptyData() {
  return { events: [], shopping: [], notes: [], meals: {}, family: DEFAULT_FAMILY.map(m => Object.assign({}, m)) };
}
function loadReal() {
  const saved = readJSON(DATA_KEY);
  return saved ? Object.assign(emptyData(), saved) : emptyData();
}

const prefs = Object.assign({ weekStart: 0, defaultView: 'month', sample: true }, readJSON(PREFS_KEY));
let data = prefs.sample ? buildSample() : loadReal();

export const getData = () => data;
export const getPrefs = () => prefs;
export const isSample = () => !!prefs.sample;

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit() { listeners.forEach(fn => fn()); }

// Change data in place, then save (real mode only) and notify.
export function mutate(fn) {
  fn(data);
  if (!prefs.sample) writeJSON(DATA_KEY, data);
  emit();
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
  data = prefs.sample ? buildSample() : loadReal();
  emit();
}

export function uid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}
