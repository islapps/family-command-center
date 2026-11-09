// Live weather for Corinth, TX from Open-Meteo (free, no API key).
// Keeps the last good reading on this device so a Wi-Fi blip doesn't blank the header.

const URL = 'https://api.open-meteo.com/v1/forecast?latitude=33.154&longitude=-97.0647' +
  '&current=temperature_2m,apparent_temperature,weather_code,is_day,wind_speed_10m,relative_humidity_2m' +
  '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max' +
  '&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America%2FChicago&forecast_days=5';
const CACHE_KEY = 'fcc.weather.v1';
const REFRESH_MS = 30 * 60 * 1000;
const STALE_MS = 6 * 60 * 60 * 1000;

export const LOCATION = 'Corinth, TX';

let state = readCache();
const listeners = new Set();

function readCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY)) || null; } catch (e) { return null; }
}

export function getWeather() {
  if (state && Date.now() - state.at > STALE_MS) return null; // too old to show as "current"
  return state;
}
export function onWeather(fn) { listeners.add(fn); }

async function load() {
  try {
    const res = await fetch(URL, { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const j = await res.json();
    const c = j.current, d = j.daily;
    state = {
      at: Date.now(),
      now: {
        temp: Math.round(c.temperature_2m), feels: Math.round(c.apparent_temperature),
        code: c.weather_code, day: c.is_day === 1, wind: Math.round(c.wind_speed_10m), humidity: Math.round(c.relative_humidity_2m),
      },
      days: d.time.map((t, i) => ({
        date: t, code: d.weather_code[i], hi: Math.round(d.temperature_2m_max[i]), lo: Math.round(d.temperature_2m_min[i]),
        pop: d.precipitation_probability_max ? d.precipitation_probability_max[i] : null,
      })),
    };
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(state)); } catch (e) { /* storage full or blocked */ }
  } catch (e) {
    // Keep showing the last good reading (if recent); getWeather() hides it once stale.
  }
  listeners.forEach(fn => fn());
}

export function startWeather() {
  load();
  setInterval(load, REFRESH_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && (!state || Date.now() - state.at > REFRESH_MS)) load();
  });
}

// WMO weather codes -> label + Lucide icon name
export function describe(code, isDay = true) {
  if (code === 0) return { label: isDay ? 'Sunny' : 'Clear', icon: isDay ? 'sun' : 'moon' };
  if (code === 1) return { label: 'Mostly clear', icon: isDay ? 'cloud-sun' : 'cloud-moon' };
  if (code === 2) return { label: 'Partly cloudy', icon: isDay ? 'cloud-sun' : 'cloud-moon' };
  if (code === 3) return { label: 'Cloudy', icon: 'cloud' };
  if (code === 45 || code === 48) return { label: 'Fog', icon: 'cloud-fog' };
  if (code >= 51 && code <= 57) return { label: 'Drizzle', icon: 'cloud-drizzle' };
  if (code >= 61 && code <= 67) return { label: code === 65 ? 'Heavy rain' : 'Rain', icon: 'cloud-rain' };
  if (code >= 71 && code <= 77) return { label: 'Snow', icon: 'cloud-snow' };
  if (code >= 80 && code <= 82) return { label: 'Showers', icon: 'cloud-rain' };
  if (code === 85 || code === 86) return { label: 'Snow showers', icon: 'cloud-snow' };
  if (code >= 95) return { label: 'Thunderstorms', icon: 'cloud-lightning' };
  return { label: '—', icon: 'cloud' };
}
