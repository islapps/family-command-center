// Meal plan: one row per day of the week, tap a row to edit its dinner.
import { icon } from '../icons.js';
import { $, $$, esc, toast } from '../ui.js';
import { getData, getPrefs, mutate, snapshot, restore } from '../store.js';
import { today, keyOf, addDays, sameDay, startOfWeek, fmt, weekRangeLabel } from '../dates.js';

let root = null;
let weekOffset = 0;
let editing = null; // date key being edited

const weekStart = () => startOfWeek(addDays(today(), weekOffset * 7), getPrefs().weekStart);
const weekKeys = () => Array.from({ length: 7 }, (_, i) => keyOf(addDays(weekStart(), i)));

function mount(el) {
  root = el;
  editing = null;
  el.innerHTML =
    '<div class="page-head">' +
      '<div><h1>Meal Plan</h1><p id="mealRange"></p></div>' +
      '<div class="ph-actions">' +
        '<button class="icon-btn" data-wk="-1" aria-label="Previous week">' + icon('chevron-left') + '</button>' +
        '<button class="btn btn-quiet" data-wk="0" id="thisWeek">This week</button>' +
        '<button class="icon-btn" data-wk="1" aria-label="Next week">' + icon('chevron-right') + '</button>' +
        '<button class="btn btn-quiet" id="clearWeek">Clear week</button>' +
      '</div>' +
    '</div>' +
    '<section class="card list-card meals" id="mealList" aria-label="Dinners this week"></section>';
  bind();
  refresh();
}

function refresh() {
  if (!root) return;
  const data = getData(), T = today(), start = weekStart();
  $('#mealRange', root).textContent = weekRangeLabel(start);
  $('#thisWeek', root).disabled = weekOffset === 0;
  const keys = weekKeys();
  $('#clearWeek', root).disabled = keys.every(k => !data.meals[k]);
  $('#mealList', root).innerHTML = keys.map((k, i) => {
    const d = addDays(start, i), meal = data.meals[k] || '', isT = sameDay(d, T);
    const dayCol = '<span class="meal-day"><b>' + fmt(d, { weekday: 'short' }) + '</b><span>' + d.getDate() + '</span></span>';
    if (editing === k) {
      return '<form class="meal-row editing' + (isT ? ' today' : '') + '" data-key="' + k + '">' + dayCol +
        '<div class="meal-edit"><input class="input" value="' + esc(meal) + '" placeholder="What’s for dinner?" maxlength="80" enterkeyhint="done" aria-label="Dinner on ' + fmt(d, { weekday: 'long' }) + '">' +
        '<div class="edit-actions"><button type="button" class="btn btn-quiet" data-cancel>Cancel</button><button type="submit" class="btn btn-primary">Save</button></div></div></form>';
    }
    return '<button class="meal-row' + (isT ? ' today' : '') + '" data-key="' + k + '" aria-label="Edit dinner for ' + fmt(d, { weekday: 'long', month: 'long', day: 'numeric' }) + '">' + dayCol +
      '<span class="meal-name' + (meal ? '' : ' unset') + '">' + (isT ? '<small>Tonight</small>' : '') + (meal ? esc(meal) : 'Not planned') + '</span>' +
      '<span class="meal-pen">' + icon('pencil', 18) + '</span></button>';
  }).join('');
  if (editing) {
    const inp = $('.editing input', root);
    if (inp) { inp.focus({ preventScroll: true }); inp.setSelectionRange(inp.value.length, inp.value.length); }
  }
}

function commit() {
  if (!editing) return;
  const inp = $('.editing input', root), k = editing;
  editing = null;
  if (inp) mutate(d => { const v = inp.value.trim(); if (v) d.meals[k] = v; else delete d.meals[k]; });
}

function bind() {
  root.addEventListener('click', e => {
    const t = e.target;
    let b;
    if ((b = t.closest('[data-wk]'))) {
      commit();
      const step = +b.dataset.wk;
      weekOffset = step === 0 ? 0 : weekOffset + step;
      refresh();
      return;
    }
    if (t.closest('#clearWeek')) {
      const before = snapshot('meals');
      const keys = weekKeys();
      editing = null;
      mutate(d => keys.forEach(k => { delete d.meals[k]; }));
      toast('Week cleared', () => restore('meals', before));
      return;
    }
    if (t.closest('[data-cancel]')) { editing = null; refresh(); return; }
    if ((b = t.closest('button.meal-row'))) {
      const k = b.dataset.key;
      if (editing) commit();
      editing = k;
      refresh();
    }
  });
  root.addEventListener('submit', e => { e.preventDefault(); commit(); refresh(); });
  root.addEventListener('keydown', e => { if (e.key === 'Escape' && editing) { editing = null; refresh(); } });
}

export default { mount, refresh, unmount() { root = null; } };
