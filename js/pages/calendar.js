// Calendar page: Month / Week / Day views plus the utility column (Today, Shopping, Tonight's dinner).
import { icon } from '../icons.js';
import { $, $$, esc, plural, isPhone, openPopover, closePopover } from '../ui.js';
import { getData, getPrefs, mutate } from '../store.js';
import { eventsOn, chipStyle, dotsHTML, whoNames, colorOf, PALETTE } from '../events.js';
import {
  today, keyOf, parseKey, addDays, addMonths, sameDay, startOfWeek, fmt, daysInMonth,
  timeLabel, hourLabel, toMin, fromMin, nowMin, relDay, weekRangeLabel,
} from '../dates.js';
import { openEventEditor } from '../editor.js';

const HOUR_WEEK = 44;         // px per hour in the Week grid
const HOUR_DAY = 56;          // px per hour in the Day grid (wider, more detail)
const LINE = 17;              // line height inside time-grid event blocks
const AGENDA_MAX = 4;         // events shown in the Today card before "+N more"
const desk = () => window.matchMedia('(min-width: 1024px) and (min-height: 600px)').matches;

let view = null;              // 'month' | 'week' | 'day'
let sel = today();            // selected day
let root = null;
let lastRange = null;         // keeps the time-grid scroll position when only data changes
let resizeTimer = null;
let wasPhone = null;
let gridHH = HOUR_WEEK;

function mount(el) {
  root = el;
  if (!view) view = getPrefs().defaultView || 'month';
  wasPhone = isPhone();
  el.innerHTML =
    '<div class="cal-page">' +
      '<section class="card cal-card" aria-label="Calendar">' +
        '<div class="cal-toolbar">' +
          '<div class="tb-nav">' +
            '<button class="icon-btn" data-nav="-1" aria-label="Previous">' + icon('chevron-left') + '</button>' +
            '<button class="icon-btn" data-nav="1" aria-label="Next">' + icon('chevron-right') + '</button>' +
            '<span class="icon-btn datepick">' + icon('calendar') + '<input type="date" id="calDate" aria-label="Go to a date"></span>' +
            '<button class="cal-title" id="calTitle" aria-haspopup="dialog" aria-expanded="false"><span></span>' + icon('chevron-down', 18) + '</button>' +
          '</div>' +
          '<div class="tb-right">' +
            '<button class="btn btn-quiet today-btn" id="calToday" hidden>Today</button>' +
            '<div class="seg" role="tablist" aria-label="Calendar view">' +
              '<button role="tab" data-view="month">Month</button>' +
              '<button role="tab" data-view="week">Week</button>' +
              '<button role="tab" data-view="day">Day</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="cal-body" id="calBody"></div>' +
        '<div class="cal-foot">' +
          '<div class="legend" id="calLegend"></div>' +
          '<button class="btn btn-primary" id="addEvent">' + icon('plus', 18) + 'Add Event</button>' +
        '</div>' +
      '</section>' +
      '<aside class="utility" aria-label="At a glance">' +
        '<section class="card u-card" id="uAgenda" aria-live="polite"></section>' +
        '<section class="card u-card" id="uShop"></section>' +
        '<button class="card u-card u-dinner" id="uDinner" type="button"></button>' +
      '</aside>' +
    '</div>';
  bind();
  refresh();
  window.addEventListener('resize', onResize);
}

function unmount() {
  window.removeEventListener('resize', onResize);
  closePopover();
  root = null;
}

function onResize() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (!root) return;
    if (isPhone() !== wasPhone) { wasPhone = isPhone(); lastRange = null; }
    renderBody();
    renderShop();
  }, 120);
}

function refresh() {
  if (!root) return;
  renderToolbar();
  renderBody();
  renderLegend();
  renderAgenda();
  renderDinner();
  renderShop(); // last: it fills whatever height the other cards leave
}

/* ---------- Toolbar ---------- */
function renderToolbar() {
  const title = $('#calTitle span', root), T = today();
  const thisYear = d => d.getFullYear() === T.getFullYear();
  const ws = startOfWeek(sel, getPrefs().weekStart);
  if (view === 'month') title.textContent = fmt(sel, { month: 'long', year: 'numeric' });
  else if (view === 'week') {
    const label = weekRangeLabel(ws);
    title.textContent = thisYear(ws) && thisYear(addDays(ws, 6)) ? label.replace(/, \d{4}$/, '') : label;
  } else title.textContent = fmt(sel, thisYear(sel) ? { weekday: 'long', month: 'short', day: 'numeric' } : { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  $$('.seg [data-view]', root).forEach(b => b.setAttribute('aria-selected', String(b.dataset.view === view)));
  const showsToday = view === 'month' ? sel.getFullYear() === T.getFullYear() && sel.getMonth() === T.getMonth()
    : view === 'week' ? sameDay(ws, startOfWeek(T, getPrefs().weekStart)) : sameDay(sel, T);
  $('#calToday', root).hidden = showsToday;
  $('#calDate', root).value = keyOf(sel);
}

function shift(dir) {
  if (view === 'month') sel = addMonths(sel, dir);
  else if (view === 'week') sel = addDays(sel, 7 * dir);
  else sel = addDays(sel, dir);
  refresh();
}

function openMonthPicker(anchor) {
  let year = sel.getFullYear();
  const T = today();
  const draw = el => {
    el.innerHTML =
      '<div class="mp-head">' +
        '<button class="icon-btn ghost" data-y="-1" aria-label="Previous year">' + icon('chevron-left') + '</button>' +
        '<b>' + year + '</b>' +
        '<button class="icon-btn ghost" data-y="1" aria-label="Next year">' + icon('chevron-right') + '</button>' +
      '</div><div class="mp-grid">' +
      Array.from({ length: 12 }, (_, m) => {
        const on = year === sel.getFullYear() && m === sel.getMonth();
        const now = year === T.getFullYear() && m === T.getMonth();
        return '<button class="mp-m' + (on ? ' on' : '') + (now ? ' now' : '') + '" data-m="' + m + '">' + fmt(new Date(year, m, 1), { month: 'short' }) + '</button>';
      }).join('') + '</div>' +
      '<button class="btn btn-quiet mp-today" data-today>Go to today</button>';
  };
  openPopover(anchor, '', el => {
    draw(el);
    el.addEventListener('click', e => {
      const yb = e.target.closest('[data-y]');
      if (yb) { year += +yb.dataset.y; draw(el); return; }
      if (e.target.closest('[data-today]')) { sel = today(); closePopover(); refresh(); return; }
      const mb = e.target.closest('[data-m]');
      if (!mb) return;
      const m = +mb.dataset.m;
      sel = new Date(year, m, Math.min(sel.getDate(), daysInMonth(year, m)));
      closePopover();
      refresh();
    });
  }, { label: 'Choose a month', align: 'start', cls: 'mp' });
}

/* ---------- Body ---------- */
function renderBody() {
  const body = $('#calBody', root);
  body.dataset.view = view;
  if (view === 'month') renderMonth(body);
  else if (view === 'week' && isPhone()) renderWeekList(body);
  else renderTimeGrid(body);
}

function chipHTML(data, e) {
  const when = e.allDay ? 'All day' : timeLabel(e.start);
  return '<button class="chip" data-ev="' + esc(e.id) + '" data-on="' + e.on + '" style="' + chipStyle(data, e) + '" ' +
    'aria-label="' + esc(e.title + ', ' + when + ', ' + whoNames(data, e.who)) + '">' + dotsHTML(data, e) + '<span>' + esc(e.title) + '</span></button>';
}

function renderMonth(body) {
  const data = getData(), ws = getPrefs().weekStart, phone = isPhone(), T = today();
  const y = sel.getFullYear(), m = sel.getMonth();
  const lead = (new Date(y, m, 1).getDay() - ws + 7) % 7;
  const days = daysInMonth(y, m);
  const rows = Math.ceil((lead + days) / 7);
  const weekStartDay = startOfWeek(T, ws);
  const dow = Array.from({ length: 7 }, (_, i) => fmt(addDays(weekStartDay, i), { weekday: 'short' }).toUpperCase());
  body.innerHTML = '<div class="mv"><div class="mv-dow" aria-hidden="true">' + dow.map(n => '<span>' + n + '</span>').join('') + '</div>' +
    '<div class="mv-grid" style="grid-template-rows:repeat(' + rows + ',minmax(0,1fr))"></div></div>';
  const grid = $('.mv-grid', body);
  let html = '';
  for (let i = 0; i < rows * 7; i++) {
    const n = i - lead + 1;
    const lastRow = i >= (rows - 1) * 7 ? ' last-row' : '';
    if (n < 1 || n > days) { html += '<div class="mv-cell out' + lastRow + '"></div>'; continue; }
    const d = new Date(y, m, n), evs = eventsOn(data, d), k = keyOf(d);
    const isSel = sameDay(d, sel), isToday = sameDay(d, T);
    const cls = 'mv-cell' + lastRow + (d < T ? ' past' : '') + (isToday ? ' today' : '') + (isSel ? ' selected' : '');
    const label = fmt(d, { weekday: 'long', month: 'long', day: 'numeric' }) + (isToday ? ', today' : '') + ', ' + (evs.length ? plural(evs.length, 'event') : 'no events');
    html += '<div class="' + cls + '"><button class="mv-hit" data-date="' + k + '" aria-label="' + label + '" aria-pressed="' + isSel + '"></button>' +
      '<span class="mv-num">' + n + '</span>';
    if (phone) {
      const seen = new Set(); evs.forEach(e => e.who.forEach(p => seen.add(p)));
      html += '<span class="mv-dots">' + data.family.filter(p => seen.has(p.id)).slice(0, 4)
        .map(p => '<i style="background:' + (PALETTE[p.color] || PALETTE.clay).dot + '"></i>').join('') + '</span>';
    } else {
      html += '<div class="mv-evs" data-date="' + k + '">' + evs.map(e => chipHTML(data, e)).join('') + '</div>';
    }
    html += '</div>';
  }
  grid.innerHTML = html;
  if (!phone) fitMonthChips(grid);
}

// Fit each day's chips to its cell. Prefer two-line chips (full names); if that hides events,
// use one-line chips when that shows more of them. Never show half a chip.
function fitMonthChips(grid) {
  $$('.mv-evs', grid).forEach(box => {
    const cell = box.parentElement, limit = cell.clientHeight - 3;
    const fits = () => box.offsetTop + box.offsetHeight <= limit;
    if (fits()) return;
    const chips = $$('.chip', box);
    const more = document.createElement('button');
    more.className = 'more';
    more.dataset.date = box.dataset.date;
    const layout = oneLine => {
      box.classList.toggle('one', oneLine);
      if (more.parentNode) box.removeChild(more);
      chips.forEach(c => box.appendChild(c));
      if (fits()) return chips.length;
      box.appendChild(more);
      let shown = chips.length;
      while (shown > 0) {
        box.removeChild(chips[--shown]);
        const hidden = chips.length - shown;
        more.textContent = '+' + hidden + ' more';
        more.setAttribute('aria-label', hidden + ' more ' + (hidden === 1 ? 'event' : 'events') + ', open in Day view');
        if (fits()) break;
      }
      return shown;
    };
    const twoLine = layout(false);
    if (twoLine < chips.length && layout(true) <= twoLine) layout(false);
  });
}

// Lay out timed events in a day column; overlapping events share the width side by side.
function layoutColumn(evs) {
  const items = evs.filter(e => !e.allDay).map(e => {
    const s = toMin(e.start);
    return { e, s, en: Math.max(toMin(e.end || e.start), s + 20) };
  }).sort((a, b) => a.s - b.s || b.en - a.en);
  let cluster = null, clusterEnd = -1;
  const clusters = [];
  items.forEach(it => {
    if (!cluster || it.s >= clusterEnd) { cluster = []; clusters.push(cluster); clusterEnd = -1; }
    cluster.push(it); clusterEnd = Math.max(clusterEnd, it.en);
  });
  clusters.forEach(cl => {
    const lanes = [];
    cl.forEach(it => {
      let li = lanes.findIndex(end => end <= it.s);
      if (li === -1) { li = lanes.length; lanes.push(0); }
      lanes[li] = it.en; it.lane = li;
    });
    cl.forEach(it => { it.lanes = lanes.length; });
  });
  return items;
}

function renderTimeGrid(body) {
  const data = getData(), T = today();
  const n = view === 'week' ? 7 : 1;
  const first = view === 'week' ? startOfWeek(sel, getPrefs().weekStart) : sel;
  const days = Array.from({ length: n }, (_, i) => addDays(first, i));
  const cols = days.map(d => ({ d, evs: eventsOn(data, d) }));
  const rangeKey = view + keyOf(first);
  const oldScroll = $('.tv-scroll', body);
  const keepScroll = rangeKey === lastRange && oldScroll ? oldScroll.scrollTop : null;
  const hasAllDay = cols.some(c => c.evs.some(e => e.allDay));
  const isDay = view === 'day';
  const HH = gridHH = isDay ? HOUR_DAY : HOUR_WEEK;

  let html = '<div class="tv' + (isDay ? ' tv-dayview' : '') + '" style="--cols:' + n + ';--hh:' + HH + 'px">';
  html += '<div class="tv-row tv-head"><div class="tv-gutter"></div>' + days.map(d => {
    const k = keyOf(d), isT = sameDay(d, T), isS = sameDay(d, sel);
    const label = isDay ? fmt(d, { weekday: 'long', month: 'long', day: 'numeric' }) : fmt(d, { weekday: 'short' });
    return '<button class="tv-dh' + (isT ? ' today' : '') + (isS && !isDay ? ' selected' : '') + '" data-date="' + k + '" aria-label="Open ' + fmt(d, { weekday: 'long', month: 'long', day: 'numeric' }) + ' in Day view">' +
      (isDay ? '<span>' + label + '</span>' : '<span>' + label.toUpperCase() + '</span><b>' + d.getDate() + '</b>') + '</button>';
  }).join('') + '</div>';
  if (hasAllDay) {
    html += '<div class="tv-row tv-allday"><div class="tv-gutter">All day</div>' +
      cols.map(c => '<div class="tv-adcell">' + c.evs.filter(e => e.allDay).map(e => chipHTML(data, e)).join('') + '</div>').join('') + '</div>';
  }
  html += '<div class="tv-scroll"><div class="tv-grid">';
  html += '<div class="tv-hours" aria-hidden="true">' + Array.from({ length: 23 }, (_, i) => '<span style="top:' + ((i + 1) * HH) + 'px">' + hourLabel(i + 1) + '</span>').join('') + '</div>';
  cols.forEach(c => {
    const k = keyOf(c.d);
    html += '<div class="tv-col" data-date="' + k + '" aria-label="' + fmt(c.d, { weekday: 'long' }) + '">';
    layoutColumn(c.evs).forEach(it => {
      const e = it.e, top = it.s / 60 * HH, h = Math.max(20, (it.en - it.s) / 60 * HH - 2);
      const left = (it.lane / it.lanes * 100).toFixed(3), width = (100 / it.lanes).toFixed(3);
      const range = timeLabel(e.start) + (e.end ? ' – ' + timeLabel(e.end) : '');
      const lines = Math.floor((h - 6) / LINE); // only show what fits; never half a line
      const who = whoNames(data, e.who) + (e.where ? ' · ' + e.where : '');
      let inner;
      if (lines <= 1) inner = '<b>' + esc(e.title) + '</b>' + (isDay ? '<span>' + range + '</span>' : '');
      else if (isDay) inner = '<b>' + esc(e.title) + '</b><span>' + range + '</span>' + (lines >= 3 ? '<span>' + esc(who) + '</span>' : '');
      else inner = '<b' + (lines >= 3 ? ' class="c2"' : '') + '>' + esc(e.title) + '</b><span>' + timeLabel(e.start) + '</span>';
      html += '<button class="tv-ev' + (lines <= 1 ? ' short' : '') + '" data-ev="' + esc(e.id) + '" data-on="' + k + '" ' +
        'style="top:' + top + 'px;height:' + h + 'px;left:calc(' + left + '% + 2px);width:calc(' + width + '% - 4px);' + chipStyle(data, e) + '" ' +
        'aria-label="' + esc(e.title + ', ' + range + ', ' + whoNames(data, e.who)) + '">' + inner + '</button>';
    });
    if (sameDay(c.d, T)) html += '<div class="tv-now" style="top:' + (nowMin() / 60 * HH) + 'px" aria-hidden="true"></div>';
    html += '</div>';
  });
  html += '</div></div></div>';
  body.innerHTML = html;

  const scroller = $('.tv-scroll', body);
  if (keepScroll !== null) scroller.scrollTop = keepScroll;
  else {
    const showsToday = days.some(d => sameDay(d, T));
    const hour = showsToday && nowMin() > 15 * 60 ? Math.floor(nowMin() / 60) - 3 : 7;
    scroller.scrollTop = Math.max(0, hour * HH - 12); // keep the first hour label fully visible
  }
  lastRange = rangeKey;
}

function agendaItem(data, e, past) {
  const when = e.allDay ? 'All day' : timeLabel(e.start);
  const sub = whoNames(data, e.who) + (e.where ? ' · ' + e.where : '');
  return '<button class="ag-item' + (past ? ' past' : '') + '" data-ev="' + esc(e.id) + '" data-on="' + e.on + '">' +
    '<i class="ag-ring" style="border-color:' + colorOf(data, e.who[0]).dot + '"></i>' +
    '<span class="ag-text"><b>' + when + ' – ' + esc(e.title) + '</b><span>' + esc(sub) + '</span></span></button>';
}

// Phone Week view: a readable day-by-day list instead of a squeezed hourly grid.
function renderWeekList(body) {
  const data = getData(), T = today();
  const first = startOfWeek(sel, getPrefs().weekStart);
  let html = '<div class="wl">';
  for (let i = 0; i < 7; i++) {
    const d = addDays(first, i), evs = eventsOn(data, d);
    html += '<div class="wl-day' + (sameDay(d, T) ? ' today' : '') + '">' +
      '<button class="wl-head" data-date="' + keyOf(d) + '"><b>' + (relDay(d) || fmt(d, { weekday: 'long' })) + '</b><span>' + fmt(d, { month: 'short', day: 'numeric' }) + '</span></button>' +
      (evs.length ? evs.map(e => agendaItem(data, e, false)).join('') : '<p class="wl-empty">Nothing planned</p>') + '</div>';
  }
  body.innerHTML = html + '</div>';
  lastRange = null;
}

/* ---------- Legend ---------- */
function renderLegend() {
  const data = getData();
  $('#calLegend', root).innerHTML = icon('users', 18) + data.family.map(m =>
    '<span><i style="background:' + (PALETTE[m.color] || PALETTE.clay).dot + '"></i>' + esc(m.name) + '</span>').join('');
}

/* ---------- Utility column ---------- */
function renderAgenda() {
  const data = getData(), T = today(), d = sel, isT = sameDay(d, T);
  const evs = eventsOn(data, d), nm = nowMin();
  const rel = relDay(d);
  const title = rel || fmt(d, { weekday: 'long' });
  const sub = fmt(d, rel ? { weekday: 'long', month: 'short', day: 'numeric' } : { month: 'long', day: 'numeric' });
  const shown = evs.slice(0, AGENDA_MAX);
  $('#uAgenda', root).innerHTML =
    '<div class="u-head"><div><h3>' + title + '</h3><p>' + sub + '</p></div>' +
      '<button class="icon-btn ghost" data-open-day aria-label="Open ' + title + ' in Day view">' + icon('calendar-days', 18) + '</button></div>' +
    (evs.length
      ? '<div class="ag-list">' + shown.map(e => agendaItem(data, e, isT && !e.allDay && toMin(e.end || e.start) <= nm)).join('') + '</div>' +
        (evs.length > AGENDA_MAX ? '<button class="u-link" data-open-day>' + (evs.length - AGENDA_MAX) + ' more ' + icon('arrow-right', 16) + '</button>' : '')
      : '<p class="u-empty">Nothing scheduled.</p>') +
    (isT ? '' : '<button class="u-link" data-back-today>Back to today</button>');
}

function renderShop() {
  const items = getData().shopping;
  const done = items.filter(i => i.done).length;
  $('#uShop', root).innerHTML =
    '<div class="u-head"><div><h3>Shopping List</h3><p>' + (items.length - done) + ' to get · ' + done + ' checked</p></div></div>' +
    (items.length
      ? '<div class="u-checks">' + items.slice(0, desk() ? 8 : 5).map(it =>
          '<button class="u-check' + (it.done ? ' done' : '') + '" data-shop="' + esc(it.id) + '" role="checkbox" aria-checked="' + it.done + '">' +
            '<span class="cbox">' + icon('check', 14) + '</span><span class="u-check-t">' + esc(it.name) + (it.note ? ' <em>(' + esc(it.note) + ')</em>' : '') + '</span></button>').join('') + '</div>'
      : '<p class="u-empty">The list is empty.</p>') +
    '<a class="u-link" href="#/shopping">View all ' + plural(items.length, 'item') + ' ' + icon('arrow-right', 16) + '</a>';
  fitShop();
}

// In landscape the Shopping card fills the space left in the column; drop rows that don't fit.
function fitShop() {
  const list = $('#uShop .u-checks', root);
  if (!list || !desk()) return;
  while (list.children.length > 1 && list.scrollHeight > list.clientHeight + 1) list.lastElementChild.remove();
}

function renderDinner() {
  const meal = getData().meals[keyOf(today())];
  $('#uDinner', root).innerHTML =
    '<span class="ud-ic">' + icon('utensils', 22) + '</span>' +
    '<span class="ud-body"><small>Tonight’s Dinner</small><b' + (meal ? '' : ' class="unset"') + '>' + (meal ? esc(meal) : 'Not planned yet') + '</b></span>' +
    icon('chevron-right', 18, 'ud-go');
}

/* ---------- Events ---------- */
function bind() {
  root.addEventListener('click', e => {
    const t = e.target;
    let b;
    if ((b = t.closest('[data-nav]'))) { shift(+b.dataset.nav); return; }
    if ((b = t.closest('.seg [data-view]'))) { view = b.dataset.view; refresh(); return; }
    if (t.closest('#calToday') || t.closest('[data-back-today]')) { sel = today(); refresh(); return; }
    if ((b = t.closest('#calTitle'))) { openMonthPicker(b); return; }
    if ((b = t.closest('[data-ev]'))) { openEventEditor({ id: b.dataset.ev, on: b.dataset.on }); return; }
    if ((b = t.closest('.more'))) { sel = parseKey(b.dataset.date); view = 'day'; refresh(); return; }
    if ((b = t.closest('.mv-hit'))) { sel = parseKey(b.dataset.date); renderToolbar(); renderBody(); renderAgenda(); renderShop(); return; }
    if ((b = t.closest('.tv-dh, .wl-head'))) { sel = parseKey(b.dataset.date); view = 'day'; refresh(); return; }
    if (t.closest('[data-open-day]')) { view = 'day'; refresh(); return; }
    if ((b = t.closest('[data-shop]'))) {
      const id = b.dataset.shop;
      mutate(d => { const it = d.shopping.find(x => x.id === id); if (it) it.done = !it.done; });
      return;
    }
    if (t.closest('#addEvent')) { openEventEditor({ date: sel }); return; }
    if (t.closest('#uDinner')) { location.hash = '#/meals'; return; }
    const col = t.closest('.tv-col');
    if (col && (t === col || t.classList.contains('tv-now'))) {
      const y = e.clientY - col.getBoundingClientRect().top;
      const m = Math.min(Math.floor(y / gridHH * 2) * 30, 23 * 60);
      openEventEditor({ date: parseKey(col.dataset.date), start: fromMin(m) });
    }
  });
  $('#calDate', root).addEventListener('change', e => {
    if (e.target.value) { sel = parseKey(e.target.value); refresh(); }
  });
}

export default { mount, unmount, refresh };
