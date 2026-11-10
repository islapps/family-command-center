// To-dos: one-offs for a day, plus weekly / monthly / quarterly ones that come back each period,
// optionally on a set day ("Tuesdays", "On the 1st").
import { icon } from '../icons.js';
import { $, $$, esc, openModal, toast } from '../ui.js';
import { getData, getPrefs, mutate, snapshot, restore, uid, isSample, todosBlocked } from '../store.js';
import { member, colorOf } from '../events.js';
import { today, keyOf, parseKey, addDays, startOfWeek, fmt, relDay } from '../dates.js';
import { TODO_REPEATS, QUARTER_MONTHS, ordinal, sections, isDone, periodKey, resetLabel, scheduleLabel, dueStatus } from '../todos.js';

let root = null;
// The add form remembers its choices while the app is open.
let form = { repeat: 'none', who: 'family', date: '', dueDay: '', dueMonth: '' };
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
const opt = (value, label, selected) => '<option value="' + value + '"' + (String(selected) === String(value) ? ' selected' : '') + '>' + label + '</option>';
function dayOfMonthOptions(selected, anyLabel) {
  let h = anyLabel ? opt('', anyLabel, selected) : '';
  for (let i = 1; i <= 28; i++) h += opt(String(i), ordinal(i), selected);
  return h + opt('last', 'Last day', selected);
}

// The "when" controls change with how often: a day for Once, a weekday for Weekly, and so on.
function whenControls(repeat, v) {
  if (repeat === 'none') {
    return '<label class="opt"><span>Day</span><input class="input" type="date" name="todoDate" value="' + v.date + '" aria-label="Day"></label>';
  }
  if (repeat === 'weekly') {
    const ws = getPrefs().weekStart, sun = startOfWeek(today(), 0);
    let h = opt('', 'Any day', v.dueDay);
    for (let i = 0; i < 7; i++) {
      const wd = (ws + i) % 7;
      h += opt(String(wd), fmt(addDays(sun, wd), { weekday: 'long' }), v.dueDay);
    }
    return '<label class="opt"><span>On</span><select class="input" name="dueDay" aria-label="On">' + h + '</select></label>';
  }
  if (repeat === 'monthly') {
    return '<label class="opt"><span>On</span><select class="input" name="dueDay" aria-label="On">' + dayOfMonthOptions(v.dueDay, 'Any day') + '</select></label>';
  }
  return '<label class="opt"><span>In</span><select class="input" name="dueMonth" aria-label="Month of the quarter">' +
      opt('', 'Any time', v.dueMonth) + QUARTER_MONTHS.map((months, i) => opt(String(i), months, v.dueMonth)).join('') +
    '</select></label>' +
    '<label class="opt" data-qday' + (v.dueMonth === '' ? ' hidden' : '') + '><span>On</span><select class="input" name="dueDay" aria-label="Day">' +
      dayOfMonthOptions(v.dueDay || '1') + '</select></label>';
}
// Reads the "when" controls back into to-do fields.
function readWhen(scope, repeat) {
  const val = name => { const el = scope.querySelector('[name="' + name + '"]'); return el ? el.value : ''; };
  if (repeat === 'none') return { date: val('todoDate') || val('date'), dueDay: '', dueMonth: '' };
  if (repeat === 'quarterly') { const m = val('dueMonth'); return { dueMonth: m, dueDay: m === '' ? '' : (val('dueDay') || '1') }; }
  return { dueDay: val('dueDay'), dueMonth: '' };
}
function bindQuarterDay(scope) {
  scope.addEventListener('change', e => {
    if (e.target.name !== 'dueMonth') return;
    const day = $('[data-qday]', scope);
    if (day) day.hidden = e.target.value === '';
  });
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
          '<div class="when-opts" id="whenOpts">' + whenControls(form.repeat, form) + '</div>' +
          '<label class="opt"><span>For</span><select class="input" name="todoWho" aria-label="For">' + whoOptions(form.who) + '</select></label>' +
        '</div>' +
      '</form>' +
    '</section>' +
    '<div class="todo-cols">' +
      '<div class="todo-col"><section class="card todo-sec" id="secToday"></section><section class="card todo-sec" id="secUpcoming"></section></div>' +
      '<div class="todo-col"><section class="card todo-sec" id="secWeekly"></section><section class="card todo-sec" id="secMonthly"></section><section class="card todo-sec" id="secQuarterly"></section></div>' +
    '</div>';

  const f = $('#todoForm', el);
  bindQuarterDay(f);
  f.addEventListener('submit', e => {
    e.preventDefault();
    const input = f.elements.todoText, text = input.value.trim();
    if (!text) { input.focus(); return; }
    const T = keyOf(today());
    const when = readWhen(f, form.repeat);
    form.who = f.elements.todoWho.value;
    Object.assign(form, when);
    if (form.repeat === 'none') form.date = when.date && when.date >= T ? when.date : T;
    const t = {
      id: uid(), text, who: form.who, repeat: form.repeat, date: form.repeat === 'none' ? form.date : T,
      dueDay: form.repeat === 'none' ? '' : when.dueDay, dueMonth: form.repeat === 'quarterly' ? when.dueMonth : '',
      done: false, doneFor: '', doneOn: '', at: Date.now(),
    };
    justAdded = t.id;
    input.value = '';
    mutate(d => { d.todos.push(t); });
    if (t.repeat !== 'none') {
      const sched = scheduleLabel(t, getPrefs().weekStart);
      toast('Added to ' + SECTION_COPY[t.repeat].title.toLowerCase() + (sched ? ' · ' + sched : ''));
    } else if (t.date !== T) toast('Added for ' + (relDay(parseKey(t.date)) || fmt(parseKey(t.date), { weekday: 'short', month: 'short', day: 'numeric' })));
  });
  f.addEventListener('click', e => {
    const b = e.target.closest('[data-repeat]');
    if (!b || b.dataset.repeat === form.repeat) return;
    form.repeat = b.dataset.repeat;
    form.dueDay = ''; form.dueMonth = '';
    $$('[data-repeat]', f).forEach(x => x.setAttribute('aria-checked', String(x === b)));
    $('#whenOpts', f).innerHTML = whenControls(form.repeat, form);
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
  const ws = getPrefs().weekStart, T = today();
  mutate(d => {
    const t = d.todos.find(x => x.id === id);
    if (!t) return;
    const nowDone = !isDone(t, ws, T);
    if (t.repeat === 'none') t.done = nowDone;
    else t.doneFor = nowDone ? periodKey(t.repeat, T, ws) : '';
    t.doneOn = nowDone ? keyOf(T) : '';
  });
}

function itemHTML(t, ws, kind) {
  const data = getData(), done = isDone(t, ws), T = today();
  const meta = [];
  if (t.who && t.who !== 'family') {
    const m = member(data, t.who);
    meta.push('<i style="background:' + colorOf(data, m.id).dot + '"></i>' + esc(m.name));
  }
  if (t.repeat === 'none') {
    const d = parseKey(t.date);
    if (kind === 'today' && t.date < keyOf(T)) meta.push('<b class="late">From ' + (relDay(d) || fmt(d, { weekday: 'short', month: 'short', day: 'numeric' })) + '</b>');
    if (kind === 'upcoming') meta.push(relDay(d) || fmt(d, { weekday: 'short', month: 'short', day: 'numeric' }));
  } else {
    // Under "This week" etc. a short label is enough ("Tuesdays"); in Today, say how often too.
    const sched = scheduleLabel(t, ws, T);
    if (kind === 'today') {
      if (t.repeat === 'weekly') meta.push('Every ' + sched.replace(/s$/, ''));
      else if (t.repeat === 'monthly') meta.push('Monthly · ' + sched.replace(/^On /, ''));
      else meta.push('Quarterly · ' + sched);
    } else if (sched) meta.push(sched);
    const st = dueStatus(t, ws, T);
    if (st) meta.push('<b class="' + st.cls + '">' + st.text + '</b>');
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
  const values = { date: t.date || keyOf(today()), dueDay: t.dueDay || '', dueMonth: t.dueMonth || '' };
  openModal({
    label: 'Edit to-do',
    cls: 'modal-sm',
    html:
      '<form class="ed" novalidate>' +
        '<div class="modal-head"><h2>Edit to-do</h2><button type="button" class="icon-btn ghost" data-close aria-label="Close">' + icon('x') + '</button></div>' +
        '<div class="modal-body">' +
          '<label class="field"><span>To-do</span><input class="input" name="text" maxlength="120" value="' + esc(t.text) + '"></label>' +
          '<div class="field"><span>How often</span>' + repeatSeg(t.repeat, 'data-erepeat') + '</div>' +
          '<div class="when-opts stacked" id="eWhen">' + whenControls(t.repeat, values).replace('name="todoDate"', 'name="date"') + '</div>' +
          '<label class="field"><span>For</span><select class="input" name="who">' + whoOptions(t.who || 'family') + '</select></label>' +
        '</div>' +
        '<div class="modal-foot">' +
          '<button type="button" class="btn btn-danger-ghost" data-del>' + icon('trash-2', 18) + 'Delete</button>' +
          '<div class="foot-right"><button type="button" class="btn btn-quiet" data-close>Cancel</button><button type="submit" class="btn btn-primary">Save</button></div>' +
        '</div>' +
      '</form>',
    mount(modal, close) {
      const ef = $('form', modal);
      bindQuarterDay(ef);
      ef.addEventListener('click', e => {
        const b = e.target.closest('[data-erepeat]');
        if (b) {
          if (b.dataset.erepeat === repeat) return;
          repeat = b.dataset.erepeat;
          $$('[data-erepeat]', ef).forEach(x => x.setAttribute('aria-checked', String(x === b)));
          $('#eWhen', ef).innerHTML = whenControls(repeat, { date: values.date, dueDay: '', dueMonth: '' }).replace('name="todoDate"', 'name="date"');
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
        const when = readWhen(ef, repeat);
        mutate(d => {
          const x = d.todos.find(y => y.id === id);
          if (!x) return;
          if (x.repeat !== repeat) { x.done = false; x.doneFor = ''; x.doneOn = ''; }
          x.text = text;
          x.repeat = repeat;
          x.who = ef.elements.who.value;
          x.date = repeat === 'none' ? (when.date || keyOf(today())) : (x.date || keyOf(today()));
          x.dueDay = repeat === 'none' ? '' : when.dueDay;
          x.dueMonth = repeat === 'quarterly' ? when.dueMonth : '';
        });
        close();
        toast('To-do updated');
      });
    },
  });
}

export default { mount, refresh, unmount() { root = null; } };
