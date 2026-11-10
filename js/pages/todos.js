// To-dos: one-offs for a day, plus weekly / monthly / quarterly ones that come back each period.
import { icon } from '../icons.js';
import { $, $$, esc, openModal, toast } from '../ui.js';
import { getData, getPrefs, mutate, snapshot, restore, uid, isSample, todosBlocked } from '../store.js';
import { member, colorOf } from '../events.js';
import { today, keyOf, parseKey, addDays, fmt, relDay } from '../dates.js';
import { TODO_REPEATS, sections, isDone, periodKey, resetLabel } from '../todos.js';

let root = null;
let form = { repeat: 'none', who: 'family' };   // the add form remembers its choices while the app is open
let justAdded = null;

const SECTION_COPY = {
  weekly: { title: 'This week', empty: 'Chores that come back every week. Add one above and choose Weekly.' },
  monthly: { title: 'This month', empty: 'Things to do once a month, like paying a bill. Choose Monthly when adding.' },
  quarterly: { title: 'This quarter', empty: 'Every three months, like changing the air filter. Choose Quarterly when adding.' },
};

function whoOptions(selected) {
  return getData().family.map(m =>
    '<option value="' + esc(m.id) + '"' + (m.id === selected ? ' selected' : '') + '>' + (m.group ? 'Anyone' : esc(m.name)) + '</option>').join('');
}
function repeatSeg(selected, attr) {
  return '<div class="seg" role="radiogroup" aria-label="How often">' + TODO_REPEATS.map(r =>
    '<button type="button" role="radio" ' + attr + '="' + r.id + '" aria-checked="' + (r.id === selected) + '">' + r.label + '</button>').join('') + '</div>';
}

function mount(el) {
  root = el;
  if (!form.date || form.date < keyOf(today())) form.date = keyOf(today());
  el.innerHTML =
    '<div class="page-head"><div><h1>To-dos</h1><p id="todoSub"></p></div></div>' +
    '<p class="card notice" id="todoBlocked" hidden>' + icon('info', 18) +
      '<span>To-dos need a one-time update to your database rules before they can sync between devices. Until then, to-dos added here aren’t saved.</span></p>' +
    '<section class="card todo-add">' +
      '<form id="todoForm" autocomplete="off">' +
        '<div class="add-line">' +
          '<input class="input" name="todoText" placeholder="Add a to-do…" maxlength="120" enterkeyhint="done" aria-label="New to-do">' +
          '<button class="btn btn-primary" type="submit">' + icon('plus', 18) + 'Add</button>' +
        '</div>' +
        '<div class="todo-opts">' +
          repeatSeg(form.repeat, 'data-repeat') +
          '<label class="opt" id="dateOpt"' + (form.repeat === 'none' ? '' : ' hidden') + '><span>Day</span>' +
            '<input class="input" type="date" name="todoDate" value="' + form.date + '" aria-label="Day"></label>' +
          '<label class="opt"><span>For</span><select class="input" name="todoWho" aria-label="For">' + whoOptions(form.who) + '</select></label>' +
        '</div>' +
      '</form>' +
    '</section>' +
    '<div class="todo-cols">' +
      '<div class="todo-col"><section class="card todo-sec" id="secToday"></section><section class="card todo-sec" id="secUpcoming"></section></div>' +
      '<div class="todo-col"><section class="card todo-sec" id="secWeekly"></section><section class="card todo-sec" id="secMonthly"></section><section class="card todo-sec" id="secQuarterly"></section></div>' +
    '</div>';

  const f = $('#todoForm', el);
  f.addEventListener('submit', e => {
    e.preventDefault();
    const input = f.elements.todoText, text = input.value.trim();
    if (!text) { input.focus(); return; }
    const T = keyOf(today());
    form.who = f.elements.todoWho.value;
    form.date = f.elements.todoDate.value && f.elements.todoDate.value >= T ? f.elements.todoDate.value : T;
    const t = { id: uid(), text, who: form.who, repeat: form.repeat, date: form.repeat === 'none' ? form.date : T, done: false, doneFor: '', at: Date.now() };
    justAdded = t.id;
    input.value = '';
    mutate(d => { d.todos.push(t); });
    if (t.repeat !== 'none') toast('Added to ' + SECTION_COPY[t.repeat].title.toLowerCase());
    else if (t.date !== T) toast('Added for ' + (relDay(parseKey(t.date)) || fmt(parseKey(t.date), { weekday: 'short', month: 'short', day: 'numeric' })));
  });
  f.addEventListener('click', e => {
    const b = e.target.closest('[data-repeat]');
    if (!b) return;
    form.repeat = b.dataset.repeat;
    $$('[data-repeat]', f).forEach(x => x.setAttribute('aria-checked', String(x === b)));
    $('#dateOpt', f).hidden = form.repeat !== 'none';
  });
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const id = b.closest('[data-id]').dataset.id;
    if (b.dataset.act === 'toggle') toggle(id);
    else if (b.dataset.act === 'edit') openTodoEditor(id);
  });

  // Finished one-offs older than a month are no longer shown anywhere; tidy them away.
  const cutoff = keyOf(addDays(today(), -30));
  if (!isSample() && getData().todos.some(t => t.repeat === 'none' && t.done && t.date < cutoff)) {
    mutate(d => { d.todos = d.todos.filter(t => !(t.repeat === 'none' && t.done && t.date < cutoff)); });
  }
  refresh();
}

function toggle(id) {
  const ws = getPrefs().weekStart;
  mutate(d => {
    const t = d.todos.find(x => x.id === id);
    if (!t) return;
    if (t.repeat === 'none') t.done = !t.done;
    else t.doneFor = isDone(t, ws) ? '' : periodKey(t.repeat, today(), ws);
  });
}

function itemHTML(t, ws, kind) {
  const data = getData(), done = isDone(t, ws);
  const meta = [];
  if (t.who && t.who !== 'family') {
    const m = member(data, t.who);
    meta.push('<i style="background:' + colorOf(data, m.id).dot + '"></i>' + esc(m.name));
  }
  if (kind === 'today' && t.date < keyOf(today())) {
    const d = parseKey(t.date);
    meta.push('<b class="late">From ' + (relDay(d) || fmt(d, { weekday: 'short', month: 'short', day: 'numeric' })) + '</b>');
  }
  if (kind === 'upcoming') {
    const d = parseKey(t.date);
    meta.push(relDay(d) || fmt(d, { weekday: 'short', month: 'short', day: 'numeric' }));
  }
  return '<div class="todo-item' + (done ? ' done' : '') + (t.id === justAdded ? ' pop' : '') + '" data-id="' + esc(t.id) + '">' +
    '<button class="todo-check" data-act="toggle" role="checkbox" aria-checked="' + done + '" aria-label="' + esc(t.text) + '"><span class="cbox lg">' + icon('check', 18) + '</span></button>' +
    '<button class="todo-body" data-act="edit" aria-label="Edit ' + esc(t.text) + '"><span class="todo-text">' + esc(t.text) + '</span>' +
      (meta.length ? '<span class="todo-meta">' + meta.join('<span class="sep">·</span>') + '</span>' : '') + '</button>' +
  '</div>';
}

function sectionHTML(title, sub, items, ws, kind, emptyText) {
  const done = items.filter(t => isDone(t, ws)).length;
  return '<div class="sec-top"><div><h2>' + title + '</h2><p>' + sub + '</p></div>' +
      (items.length && kind !== 'upcoming' ? '<span class="sec-count' + (done === items.length ? ' all' : '') + '">' + done + ' of ' + items.length + ' done</span>' : '') + '</div>' +
    (items.length ? '<div class="todo-list">' + items.map(t => itemHTML(t, ws, kind)).join('') + '</div>'
      : '<p class="todo-empty">' + emptyText + '</p>');
}

function refresh() {
  if (!root) return;
  const ws = getPrefs().weekStart, T = today();
  const s = sections(getData().todos, ws, T);
  const left = s.today.filter(t => !isDone(t, ws)).length;
  const weekLeft = s.weekly.filter(t => !isDone(t, ws)).length;
  $('#todoSub', root).textContent = (left ? left + ' left today' : 'All done for today') + (s.weekly.length ? ' · ' + weekLeft + ' left this week' : '');
  $('#todoBlocked', root).hidden = !todosBlocked();
  $('#secToday', root).innerHTML = sectionHTML('Today', fmt(T, { weekday: 'long', month: 'long', day: 'numeric' }), s.today, ws, 'today',
    'Nothing on the list for today.');
  const up = $('#secUpcoming', root);
  up.hidden = !s.upcoming.length;
  up.innerHTML = s.upcoming.length ? sectionHTML('Coming up', 'One-off to-dos for later days', s.upcoming, ws, 'upcoming', '') : '';
  ['weekly', 'monthly', 'quarterly'].forEach(r => {
    const id = '#sec' + r.charAt(0).toUpperCase() + r.slice(1);
    $(id, root).innerHTML = sectionHTML(SECTION_COPY[r].title, resetLabel(r, ws, T), s[r], ws, r, SECTION_COPY[r].empty);
  });
  // Keep the "For" list in step with Family page changes without touching what's being typed.
  const sel = $('[name="todoWho"]', root);
  if (sel && document.activeElement !== sel) sel.innerHTML = whoOptions(form.who);
  justAdded = null;
}

function openTodoEditor(id) {
  const t = getData().todos.find(x => x.id === id);
  if (!t) return;
  let repeat = t.repeat;
  openModal({
    label: 'Edit to-do',
    cls: 'modal-sm',
    html:
      '<form class="ed" novalidate>' +
        '<div class="modal-head"><h2>Edit to-do</h2><button type="button" class="icon-btn ghost" data-close aria-label="Close">' + icon('x') + '</button></div>' +
        '<div class="modal-body">' +
          '<label class="field"><span>To-do</span><input class="input" name="text" maxlength="120" value="' + esc(t.text) + '"></label>' +
          '<div class="field"><span>How often</span>' + repeatSeg(t.repeat, 'data-erepeat') + '</div>' +
          '<label class="field" id="eDate"' + (t.repeat === 'none' ? '' : ' hidden') + '><span>Day</span><input class="input" type="date" name="date" value="' + t.date + '"></label>' +
          '<label class="field"><span>For</span><select class="input" name="who">' + whoOptions(t.who || 'family') + '</select></label>' +
        '</div>' +
        '<div class="modal-foot">' +
          '<button type="button" class="btn btn-danger-ghost" data-del>' + icon('trash-2', 18) + 'Delete</button>' +
          '<div class="foot-right"><button type="button" class="btn btn-quiet" data-close>Cancel</button><button type="submit" class="btn btn-primary">Save</button></div>' +
        '</div>' +
      '</form>',
    mount(modal, close) {
      const ef = $('form', modal);
      ef.addEventListener('click', e => {
        const b = e.target.closest('[data-erepeat]');
        if (b) {
          repeat = b.dataset.erepeat;
          $$('[data-erepeat]', ef).forEach(x => x.setAttribute('aria-checked', String(x === b)));
          $('#eDate', ef).hidden = repeat !== 'none';
          return;
        }
        if (e.target.closest('[data-del]')) {
          const before = snapshot('todos');
          mutate(d => { d.todos = d.todos.filter(x => x.id !== id); });
          close();
          toast('To-do deleted', () => restore('todos', before));
        }
      });
      ef.addEventListener('submit', e => {
        e.preventDefault();
        const text = ef.elements.text.value.trim();
        if (!text) { ef.elements.text.focus(); return; }
        mutate(d => {
          const x = d.todos.find(y => y.id === id);
          if (!x) return;
          if (x.repeat !== repeat) { x.done = false; x.doneFor = ''; }
          x.text = text;
          x.repeat = repeat;
          x.who = ef.elements.who.value;
          x.date = repeat === 'none' ? (ef.elements.date.value || keyOf(today())) : (x.date || keyOf(today()));
        });
        close();
        toast('To-do updated');
      });
    },
  });
}

export default { mount, refresh, unmount() { root = null; } };
