// App shell: sidebar, header (date · weather · time), phone bottom bar, and page routing.
import { icon } from './icons.js';
import { $, $$, esc, openModal, openPopover } from './ui.js';
import { getData, subscribe, isSample } from './store.js';
import { startWeather, onWeather, getWeather, describe, LOCATION } from './weather.js';
import { fmt, keyOf, today, parseKey } from './dates.js';
import calendar from './pages/calendar.js';
import meals from './pages/meals.js';
import shopping from './pages/shopping.js';
import notes from './pages/notes.js';
import family from './pages/family.js';
import settings from './pages/settings.js';

const PAGES = { calendar, meals, shopping, notes, family, settings };
const MAIN_NAV = [
  { id: 'calendar', label: 'Calendar', icon: 'calendar' },
  { id: 'meals', label: 'Meals', icon: 'utensils' },
  { id: 'shopping', label: 'Shopping', icon: 'shopping-cart', count: d => d.shopping.filter(i => !i.done).length },
  { id: 'notes', label: 'Notes', icon: 'notebook-pen', count: d => d.notes.filter(n => !n.done).length },
];
const MORE_NAV = [
  { id: 'family', label: 'Family', icon: 'users' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

let currentId = null;
let currentPage = null;

/* ---------- Sidebar + bottom bar ---------- */
function navItem(n) {
  return '<a class="nav-item" href="#/' + n.id + '" data-page="' + n.id + '">' + icon(n.icon, 20) +
    '<span>' + n.label + '</span>' + (n.count ? '<em class="badge" data-count="' + n.id + '" hidden></em>' : '') + '</a>';
}
function renderShell() {
  $('#sidebar').innerHTML =
    '<a class="brand" href="#/calendar" aria-label="McAfee Family Command Center, home">' +
      '<span class="brand-mark">' + icon('mountain', 40) + '</span>' +
      '<b>McAfee Family</b><small>Command Center</small></a>' +
    '<nav class="nav" aria-label="Main">' + MAIN_NAV.map(navItem).join('') + '</nav>' +
    '<hr class="nav-sep">' +
    '<nav class="nav" aria-label="Family and settings">' + MORE_NAV.map(navItem).join('') + '</nav>' +
    '<a class="sample-pill" id="samplePill" href="#/settings" hidden>' + icon('info', 16) + 'Showing sample data</a>';

  $('#bottomnav').innerHTML = MAIN_NAV.map(n =>
    '<a class="bn-item" href="#/' + n.id + '" data-page="' + n.id + '">' + icon(n.icon, 22) + '<span>' + n.label + '</span>' +
      (n.count ? '<em class="badge" data-count="' + n.id + '" hidden></em>' : '') + '</a>').join('') +
    '<button class="bn-item" id="moreBtn" type="button" data-page="more">' + icon('menu', 22) + '<span>More</span></button>';

  $('#moreBtn').addEventListener('click', () => {
    openModal({
      label: 'More',
      cls: 'modal-sm',
      html: '<div class="modal-head"><h2>More</h2><button class="icon-btn ghost" data-close aria-label="Close">' + icon('x') + '</button></div>' +
        '<div class="modal-body more-list">' + MORE_NAV.map(n =>
          '<a class="nav-item" href="#/' + n.id + '" data-close>' + icon(n.icon, 20) + '<span>' + n.label + '</span></a>').join('') + '</div>',
    });
  });
}

function renderBadges() {
  const d = getData();
  MAIN_NAV.filter(n => n.count).forEach(n => {
    const c = n.count(d);
    $$('[data-count="' + n.id + '"]').forEach(el => { el.textContent = c; el.hidden = !c; });
  });
  $('#samplePill').hidden = !isSample();
}

function setActiveNav() {
  $$('[data-page]').forEach(a => {
    const on = a.dataset.page === currentId || (a.dataset.page === 'more' && (currentId === 'family' || currentId === 'settings'));
    a.classList.toggle('active', on);
    if (a.tagName === 'A') { if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); }
  });
}

/* ---------- Header ---------- */
let lastMinute = -1;
let lastDay = keyOf(today());

function renderDate() {
  const d = new Date();
  $('#hdrDay').textContent = fmt(d, { weekday: 'long' });
  $('#hdrDate').innerHTML = '<span class="long">' + fmt(d, { month: 'long', day: 'numeric', year: 'numeric' }) + '</span>' +
    '<span class="short">' + fmt(d, { month: 'short', day: 'numeric' }) + '</span>';
}
function renderClock() {
  const d = new Date();
  if (d.getMinutes() === lastMinute) return;
  lastMinute = d.getMinutes();
  let h = d.getHours();
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  $('#hdrTime').innerHTML = h + ':' + String(d.getMinutes()).padStart(2, '0') + '<small>' + ap + '</small>';
  $('#hdrTime').setAttribute('datetime', d.toISOString());
  // A new day on an always-on display: refresh everything that depends on "today".
  const k = keyOf(today());
  if (k !== lastDay) { lastDay = k; renderDate(); if (currentPage) currentPage.refresh(); }
  else if (currentId === 'calendar' && currentPage) currentPage.refresh(); // moves the "now" line, dims past events
}
function renderWeather() {
  const w = getWeather(), btn = $('#hdrWx');
  if (!w) {
    btn.innerHTML = '<span class="wx-ic muted">' + icon('cloud', 36) + '</span><span class="wx-text"><b>—°</b><span>Weather unavailable</span></span>';
    btn.setAttribute('aria-label', 'Weather unavailable');
    return;
  }
  const c = describe(w.now.code, w.now.day);
  btn.innerHTML = '<span class="wx-ic">' + icon(c.icon, 36) + '</span><span class="wx-text"><b>' + w.now.temp + '°</b><span>' + c.label + '</span></span>';
  btn.setAttribute('aria-label', 'Weather: ' + w.now.temp + ' degrees, ' + c.label + '. Show forecast');
}
function openForecast(anchor) {
  const w = getWeather();
  if (!w) return;
  const lo = Math.min.apply(null, w.days.map(d => d.lo)), hi = Math.max.apply(null, w.days.map(d => d.hi));
  const pct = v => ((v - lo) / Math.max(1, hi - lo) * 100).toFixed(1);
  const c = describe(w.now.code, w.now.day);
  openPopover(anchor,
    '<div class="fc-head"><div><b>' + LOCATION + '</b><span>' + c.label + ' · Feels like ' + w.now.feels + '°</span></div>' +
      '<span>Wind ' + w.now.wind + ' mph · Humidity ' + w.now.humidity + '%</span></div>' +
    '<div class="fc-rows">' + w.days.map((d, i) => {
      const dd = describe(d.code, true);
      return '<div class="fc-row"><b>' + (i === 0 ? 'Today' : fmt(parseKey(d.date), { weekday: 'short' })) + '</b>' +
        '<span class="fc-ic" title="' + dd.label + '">' + icon(dd.icon, 22) + '</span>' +
        '<span class="fc-pop">' + (d.pop >= 20 ? d.pop + '%' : '') + '</span>' +
        '<span class="fc-lo">' + d.lo + '°</span>' +
        '<span class="fc-bar"><i style="left:' + pct(d.lo) + '%;width:' + (pct(d.hi) - pct(d.lo)).toFixed(1) + '%"></i></span>' +
        '<span class="fc-hi">' + d.hi + '°</span></div>';
    }).join('') + '</div>' +
    '<p class="fc-foot">Open-Meteo · Updated ' + new Date(w.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) + '</p>',
    null, { label: '5-day forecast', cls: 'forecast' });
}

/* ---------- Routing ---------- */
function route() {
  const id = (location.hash.replace(/^#\/?/, '').split(/[?/]/)[0]) || 'calendar';
  const next = PAGES[id] ? id : 'calendar';
  if (currentPage && currentPage.unmount) currentPage.unmount();
  currentId = next;
  currentPage = PAGES[next];
  // A fresh element per visit, so listeners from the previous page can't pile up.
  const old = $('#page');
  const el = old.cloneNode(false);
  el.className = 'page page-' + next;
  old.replaceWith(el);
  window.scrollTo(0, 0);
  currentPage.mount(el);
  setActiveNav();
  document.title = (next === 'calendar' ? '' : $('[data-page="' + next + '"] span').textContent + ' · ') + 'McAfee Family';
}

/* ---------- Start ---------- */
renderShell();
renderDate();
renderClock();
renderWeather();
renderBadges();
route();
window.addEventListener('hashchange', route);
subscribe(() => { if (currentPage) currentPage.refresh(); renderBadges(); });
onWeather(() => { renderWeather(); if (currentId === 'settings') currentPage.refresh(); });
$('#hdrWx').addEventListener('click', e => openForecast(e.currentTarget));
setInterval(renderClock, 5000);
startWeather();
