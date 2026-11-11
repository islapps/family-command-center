// Calendar page: Month / Week / Day views plus the utility column (Today, Shopping, Tonight's dinner).
import { icon } from '../icons.js';
import { $, $$, esc, plural, isPhone, openPopover, closePopover } from '../ui.js';
import { getData, getPrefs, mutate } from '../store.js';
import { eventsOn, chipStyle, dotsHTML, whoNames, colorOf, PALETTE, whenLabel, dayOfLabel, isTopOfDay } from '../events.js';
import {
  today, keyOf, parseKey, addDays, addMonths, sameDay, startOfWeek, fmt, daysInMonth,
  timeLabel, hourLabel, toMin, fromMin, nowMin, relDay, weekRangeLabel,
} from '../dates.js';
import { openEventEditor } from '../editor.js';

const HOUR_WEEK = 44;         // px per hour in the Week grid
const HOUR_DAY = 56;          // px per hour in the Day grid (wider, more detail)
const LINE = 17;              // line height inside time-grid event blocks
const AGENDA_MAX = 4;         // events shown in the Today card before "+N more"
const LANE = 25;              // month view: height of one multi-day bar row (22px bar + 3px gap)
const BAR_TOP = 33;           // month view: where bars start inside a day (below the date number)
const desk = () => window.matchMedia('(min-width: 1024px) and (min-height: 600px)').matches;

let view = null;              // 'month' | 'week' | 'day'
let appliedDefault = null;    // the "Opens in" setting last applied
let sel = today();            // selected day
let todayKey = keyOf(sel);    // to notice midnight on an always-on display
let root = null;
let lastRange = null;         // keeps the time-grid scroll position when only data changes
let resizeTimer = null;
let wasPhone = null;
let gridHH = HOUR_WEEK;

function mount(el) {
  root = el;
  // Use the "Opens in" setting on first open, and again whenever it's changed in Settings.
  const preferred = getPrefs().defaultView || 'day';
  if (!view || preferred !== appliedDefault) { view = preferred; appliedDefault = preferred; }
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
            '<button class="icon-btn add-top" id="addEventTop" aria-label="Add event">' + icon('plus', 22) + '</button>' +
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
  // After midnight, if the old "today" was selected, follow the calendar to the new day.
  const k = keyOf(today());
  if (k !== todayKey) {
    if (keyOf(sel) === todayKey) sel = today();
    todayKey = k;
  }
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
  if (view === 'month') title.textContent = fmt(sel, { month: window.innerWidth < 360 ? 'short' : 'long', year: 'numeric' });
  else if (view === 'week') {
    const label = weekRangeLabel(ws);
    title.textContent = thisYear(ws) && thisYear(addDays(ws, 6)) ? label.replace(/, \d{4}$/, '') : label;
  } else title.textContent = fmt(sel, thisYear(sel) ? { weekday: isPhone() ? 'short' : 'long', month: 'short', day: 'numeric' } : { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
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
  const when = whenLabel(e, timeLabel);
  return '<button class="chip" data-ev="' + esc(e.id) + '" data-on="' + e.on + '" data-occ="' + e.occ + '" style="' + chipStyle(data, e) + '" ' +
    'aria-label="' + esc(e.title + ', ' + when + ', ' + whoNames(data, e.who)) + '">' + dotsHTML(data, e) + '<span>' + esc(e.title) + '</span></button>';
}

const occRange = e => fmt(parseKey(e.occ), { month: 'short', day: 'numeric' }) + ' – ' +
  fmt(addDays(parseKey(e.occ), e.span - 1), { month: 'short', day: 'numeric' });

// Group a stretch of days into bars: one per event occurrence, from its first to last column here.
// cols: array of { evs } (or null for days outside the month).
function collectBars(cols, isBar) {
  const map = new Map();
  cols.forEach((c, i) => {
    if (!c) return;
    c.evs.forEach(e => {
      if (!isBar(e)) return;
      const key = e.id + '|' + e.occ;
      const bar = map.get(key);
      if (bar) { bar.c1 = i; bar.last = e; } else map.set(key, { key, e, last: e, c0: i, c1: i });
    });
  });
  return Array.from(map.values());
}
// Stack overlapping bars into lanes (earliest first, then longest) so each bar keeps one row.
function packLanes(bars) {
  bars.sort((a, b) => a.c0 - b.c0 || (b.c1 - b.c0) - (a.c1 - a.c0) || a.key.localeCompare(b.key));
  const lanes = [];
  bars.forEach(b => {
    let li = lanes.findIndex(end => end < b.c0);
    if (li === -1) { li = lanes.length; lanes.push(-1); }
    lanes[li] = b.c1; b.lane = li;
  });
  return lanes.length;
}
function barHTML(data, b, style, detail) {
  const e = b.e;
  const cls = 'span-bar' + (e.dayIndex === 0 ? ' s-start' : '') + (b.last.dayIndex === b.last.span - 1 ? ' s-end' : '');
  const range = e.span > 1 ? occRange(e) : 'All day';
  const label = e.span > 1 && !e.allDay && e.dayIndex === 0 ? timeLabel(e.start) + ' ' + e.title : e.title;
  return '<button class="' + cls + '" data-ev="' + esc(e.id) + '" data-on="' + e.on + '" data-occ="' + e.occ + '" ' +
    'style="' + style + chipStyle(data, e) + '" aria-label="' + esc(e.title + ', ' + range + ', ' + whoNames(data, e.who)) + '">' +
    dotsHTML(data, e) + '<span>' + esc(label) + '</span>' + (detail && e.span > 1 ? '<em>' + dayOfLabel(e) + '</em>' : '') + '</button>';
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
  const rowH = grid.clientHeight ? grid.clientHeight / rows : 100;
  // Each day's events, by grid position (null outside this month).
  const cells = Array.from({ length: rows * 7 }, (_, i) => {
    const n = i - lead + 1;
    return n < 1 || n > days ? null : { d: new Date(y, m, n), evs: eventsOn(data, new Date(y, m, n)) };
  });
  // Multi-day events become bars across each week row. Lanes that don't fit go into "+N more".
  const maxLanes = Math.max(1, Math.floor((rowH - BAR_TOP - 22) / LANE));
  const reserve = new Array(rows * 7).fill(0), hiddenBars = new Array(rows * 7).fill(0);
  let bars = '';
  if (!phone) {
    for (let r = 0; r < rows; r++) {
      const rowBars = collectBars(cells.slice(r * 7, r * 7 + 7), e => e.span > 1);
      packLanes(rowBars);
      rowBars.forEach(b => {
        for (let c = b.c0; c <= b.c1; c++) {
          if (b.lane < maxLanes) reserve[r * 7 + c] = Math.max(reserve[r * 7 + c], b.lane + 1);
          else hiddenBars[r * 7 + c]++;
        }
        if (b.lane >= maxLanes) return;
        bars += barHTML(data, b, 'top:' + (r * rowH + BAR_TOP + b.lane * LANE) + 'px;' +
          'left:calc(' + (b.c0 / 7 * 100).toFixed(4) + '% + 3px);width:calc(' + ((b.c1 - b.c0 + 1) / 7 * 100).toFixed(4) + '% - 6px);', false);
      });
    }
  }
  let html = '';
  for (let i = 0; i < rows * 7; i++) {
    const lastRow = i >= (rows - 1) * 7 ? ' last-row' : '';
    if (!cells[i]) { html += '<div class="mv-cell out' + lastRow + '"></div>'; continue; }
    const d = cells[i].d, evs = cells[i].evs, k = keyOf(d), n = d.getDate();
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
      html += '<div class="mv-evs" data-date="' + k + '" data-hidden="' + hiddenBars[i] + '"' +
        (reserve[i] ? ' style="padding-top:' + (reserve[i] * LANE) + 'px"' : '') + '>' +
        evs.filter(e => e.span === 1).map(e => chipHTML(data, e)).join('') + '</div>';
    }
    html += '</div>';
  }
  grid.innerHTML = html + bars;
  if (!phone) fitMonthChips(grid);
}

// Fit each day's chips to its cell. Prefer two-line chips (full names); if that hides events,
// use one-line chips when that shows more of them. Never show half a chip.
function fitMonthChips(grid) {
  $$('.mv-evs', grid).forEach(box => {
    const cell = box.parentElement, limit = cell.clientHeight - 3;
    const extra = +box.dataset.hidden || 0; // multi-day bars with no room in this row
    const fits = () => box.offsetTop + box.offsetHeight <= limit;
    if (fits() && !extra) return;
    const chips = $$('.chip', box);
    const more = document.createElement('button');
    more.className = 'more';
    more.dataset.date = box.dataset.date;
    const setMore = hidden => {
      more.textContent = '+' + hidden + ' more';
      more.setAttribute('aria-label', hidden + ' more ' + (hidden === 1 ? 'event' : 'events') + ', open in Day view');
    };
    const layout = oneLine => {
      box.classList.toggle('one', oneLine);
      if (more.parentNode) box.removeChild(more);
      chips.forEach(c => box.appendChild(c));
      if (!extra && fits()) return chips.length;
      box.appendChild(more);
      setMore(extra);
      let shown = chips.length;
      while (!fits() && shown > 0) {
        box.removeChild(chips[--shown]);
        setMore(chips.length - shown + extra);
      }
      return shown;
    };
    const twoLine = layout(false);
    if (twoLine < chips.length && layout(true) <= twoLine) layout(false);
  });
}

// Lay out timed events in a day column; overlapping events share the width side by side.
function layoutColumn(evs) {
  const items = evs.filter(e => !e.allDay && e.span === 1).map(e => {
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
  const isDay = view === 'day';
  const topBars = collectBars(cols, e => e.allDay || e.span > 1);
  const topLanes = packLanes(topBars);
  const HH = gridHH = isDay ? HOUR_DAY : HOUR_WEEK;

  let html = '<div class="tv' + (isDay ? ' tv-dayview' : '') + '" style="--cols:' + n + ';--hh:' + HH + 'px">';
  html += '<div class="tv-row tv-head"><div class="tv-gutter"></div>' + days.map(d => {
    const k = keyOf(d), isT = sameDay(d, T), isS = sameDay(d, sel);
    const label = isDay ? fmt(d, { weekday: 'long', month: 'long', day: 'numeric' }) : fmt(d, { weekday: 'short' });
    return '<button class="tv-dh' + (isT ? ' today' : '') + (isS && !isDay ? ' selected' : '') + '" data-date="' + k + '" aria-label="Open ' + fmt(d, { weekday: 'long', month: 'long', day: 'numeric' }) + ' in Day view">' +
      (isDay ? '<span>' + label + '</span>' : '<span>' + label.toUpperCase() + '</span><b>' + d.getDate() + '</b>') + '</button>';
  }).join('') + '</div>';
  if (topBars.length) {
    html += '<div class="tv-row tv-allday"><div class="tv-gutter">All day</div>' +
      '<div class="tv-adwrap" style="height:' + (topLanes * 25 + 5) + 'px">' + topBars.map(b => barHTML(data, b,
        'top:' + (3 + b.lane * 25) + 'px;left:calc(' + (b.c0 / n * 100).toFixed(4) + '% + 3px);width:calc(' + ((b.c1 - b.c0 + 1) / n * 100).toFixed(4) + '% - 6px);',
        isDay)).join('') + '</div></div>';
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
  const when = whenLabel(e, timeLabel);
  const sub = [whoNames(data, e.who), e.where, dayOfLabel(e)].filter(Boolean).join(' · ');
  return '<button class="ag-item' + (past ? ' past' : '') + '" data-ev="' + esc(e.id) + '" data-on="' + e.on + '" data-occ="' + e.occ + '">' +
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
// Has this occurrence finished by `nm` minutes into today?
function endsBy(e, nm) {
  if (e.allDay) return false;
  if (e.span > 1 && e.dayIndex < e.span - 1) return false; // continues tomorrow
  return toMin(e.end || e.start) <= nm;
}

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
      ? '<div class="ag-list">' + shown.map(e => agendaItem(data, e, isT && endsBy(e, nm))).join('') + '</div>' +
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
    if ((b = t.closest('[data-ev]'))) { openEventEditor({ id: b.dataset.ev, on: b.dataset.on, occ: b.dataset.occ }); return; }
    if ((b = t.closest('.more'))) { sel = parseKey(b.dataset.date); view = 'day'; refresh(); return; }
    if ((b = t.closest('.mv-hit'))) { sel = parseKey(b.dataset.date); renderToolbar(); renderBody(); renderAgenda(); renderShop(); return; }
    if ((b = t.closest('.tv-dh, .wl-head'))) { sel = parseKey(b.dataset.date); view = 'day'; refresh(); return; }
    if (t.closest('[data-open-day]')) { view = 'day'; refresh(); return; }
    if ((b = t.closest('[data-shop]'))) {
      const id = b.dataset.shop;
      mutate(d => { const it = d.shopping.find(x => x.id === id); if (it) it.done = !it.done; });
      return;
    }
    if (t.closest('#addEvent, #addEventTop')) { openEventEditor({ date: sel }); return; }
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
