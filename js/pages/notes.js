// Family notes: who wrote it, when, check off, delete (with Undo).
import { icon } from '../icons.js';
import { $, $$, esc, plural, toast } from '../ui.js';
import { getData, getPrefs, setPrefs, mutate, snapshot, restore, uid } from '../store.js';
import { member, colorOf } from '../events.js';
import { today, addDays, sameDay, fmt } from '../dates.js';

let root = null;
let justAdded = null;

const authors = () => getData().family.filter(m => !m.group);
function currentAuthor() {
  const list = authors(), saved = getPrefs().noteAuthor;
  return list.some(m => m.id === saved) ? saved : (list[0] ? list[0].id : 'family');
}

function ago(ts) {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return mins + ' min ago';
  const d = new Date(ts), time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (sameDay(d, today())) return 'Today, ' + time;
  if (sameDay(d, addDays(today(), -1))) return 'Yesterday, ' + time;
  return fmt(d, { month: 'short', day: 'numeric' }) + ', ' + time;
}

function mount(el) {
  root = el;
  el.innerHTML =
    '<div class="page-head"><div><h1>Notes</h1><p id="noteSub"></p></div></div>' +
    '<section class="card composer-card">' +
      '<form id="noteForm" autocomplete="off">' +
        '<textarea class="input" name="text" rows="2" maxlength="280" placeholder="Leave a note for the family…" aria-label="New note"></textarea>' +
        '<div class="composer-row"><div class="seg sm" role="radiogroup" aria-label="Note from" id="authorSeg"></div>' +
        '<button class="btn btn-primary" type="submit">' + icon('plus', 18) + 'Add note</button></div>' +
      '</form>' +
    '</section>' +
    '<div class="notes-grid" id="noteGrid"></div>';
  $('#noteForm', el).addEventListener('submit', e => {
    e.preventDefault();
    const ta = e.target.elements.text, text = ta.value.trim();
    if (!text) { ta.focus(); return; }
    const n = { id: uid(), by: currentAuthor(), at: Date.now(), done: false, text };
    justAdded = n.id;
    ta.value = '';
    ta.blur();
    mutate(d => { d.notes.unshift(n); });
  });
  el.addEventListener('click', e => {
    const a = e.target.closest('[data-author]');
    if (a) { setPrefs({ noteAuthor: a.dataset.author }); return; }
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const id = b.closest('.note-card').dataset.id;
    if (b.dataset.act === 'toggle') {
      mutate(d => { const n = d.notes.find(x => x.id === id); if (n) n.done = !n.done; });
    } else {
      const before = snapshot('notes');
      mutate(d => { d.notes = d.notes.filter(x => x.id !== id); });
      toast('Note deleted', () => restore('notes', before));
    }
  });
  refresh();
}

function refresh() {
  if (!root) return;
  const data = getData(), who = currentAuthor();
  $('#authorSeg', root).innerHTML = authors().map(m =>
    '<button type="button" role="radio" data-author="' + esc(m.id) + '" aria-checked="' + (m.id === who) + '">' +
      '<i style="background:' + colorOf(data, m.id).dot + '"></i>' + esc(m.name) + '</button>').join('');
  const open = data.notes.filter(n => !n.done).length;
  $('#noteSub', root).textContent = data.notes.length ? plural(open, 'open note') : 'No notes yet';
  $('#noteGrid', root).innerHTML = data.notes.length
    ? data.notes.map(n => {
        const m = member(data, n.by);
        return '<article class="card note-card' + (n.done ? ' done' : '') + (n.id === justAdded ? ' pop' : '') + '" data-id="' + esc(n.id) + '">' +
          '<button class="note-check" data-act="toggle" role="checkbox" aria-checked="' + n.done + '" aria-label="' + (n.done ? 'Mark as not done' : 'Mark as done') + '"><span class="cbox round">' + icon('check', 14) + '</span></button>' +
          '<div class="note-body"><p class="note-text">' + esc(n.text) + '</p>' +
            '<p class="note-meta"><i style="background:' + colorOf(data, m.id).dot + '"></i>' + esc(m.name) + ' · ' + ago(n.at) + '</p></div>' +
          '<button class="icon-btn ghost note-del" data-act="del" aria-label="Delete note">' + icon('trash-2', 18) + '</button>' +
        '</article>';
      }).join('')
    : '<p class="empty">Nothing here yet. Notes you add show up for the whole family.</p>';
  justAdded = null;
}

let timer = setInterval(() => { if (root) refresh(); }, 60000); // keep "5 min ago" fresh

export default { mount, refresh, unmount() { root = null; } };
