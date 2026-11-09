// Family members: names and calendar colors.
import { icon } from '../icons.js';
import { $, esc, openModal, toast } from '../ui.js';
import { getData, mutate, snapshot, restore, uid } from '../store.js';
import { PALETTE } from '../events.js';

let root = null;

function mount(el) {
  root = el;
  el.innerHTML =
    '<div class="page-head"><div><h1>Family</h1><p>Names and colors used across the calendar and notes.</p></div></div>' +
    '<section class="card list-card" id="memberList"></section>' +
    '<section class="card list-card add-member">' +
      '<form class="add-row" id="memberForm" autocomplete="off">' +
        '<input class="input" name="name" maxlength="24" placeholder="Add a family member…" aria-label="New member name">' +
        '<button class="btn btn-primary" type="submit">' + icon('plus', 18) + 'Add</button>' +
      '</form>' +
    '</section>';

  $('#memberForm', el).addEventListener('submit', e => {
    e.preventDefault();
    const input = e.target.elements.name, name = input.value.trim();
    if (!name) { input.focus(); return; }
    const used = getData().family.map(m => m.color);
    const color = Object.keys(PALETTE).find(c => used.indexOf(c) === -1) || 'teal';
    input.value = '';
    mutate(d => { d.family.push({ id: uid(), name, color }); });
    toast(name + ' added');
  });
  el.addEventListener('click', e => {
    const sw = e.target.closest('[data-color]');
    if (sw) {
      const id = sw.closest('[data-member]').dataset.member;
      mutate(d => { const m = d.family.find(x => x.id === id); if (m) m.color = sw.dataset.color; });
      return;
    }
    const rm = e.target.closest('[data-remove]');
    if (rm) confirmRemove(rm.closest('[data-member]').dataset.member);
  });
  el.addEventListener('change', e => {
    const input = e.target.closest('input[data-name]');
    if (!input) return;
    const id = input.closest('[data-member]').dataset.member, name = input.value.trim();
    if (!name) { refresh(); return; }
    mutate(d => { const m = d.family.find(x => x.id === id); if (m) m.name = name; });
  });
  refresh();
}

function confirmRemove(id) {
  const m = getData().family.find(x => x.id === id);
  if (!m) return;
  openModal({
    label: 'Remove ' + m.name,
    cls: 'modal-sm',
    html:
      '<div class="modal-head"><h2>Remove ' + esc(m.name) + '?</h2></div>' +
      '<div class="modal-body"><p>Their events will move to Family. Notes they wrote stay.</p></div>' +
      '<div class="modal-foot"><span></span><div class="foot-right"><button class="btn btn-quiet" data-close>Cancel</button>' +
      '<button class="btn btn-danger" data-confirm>Remove</button></div></div>',
    mount(modal, close) {
      $('[data-confirm]', modal).addEventListener('click', () => {
        const fam = snapshot('family'), evs = snapshot('events');
        mutate(d => {
          d.family = d.family.filter(x => x.id !== id);
          d.events.forEach(ev => {
            ev.who = ev.who.filter(w => w !== id);
            if (!ev.who.length) ev.who = ['family'];
          });
        });
        close();
        toast(m.name + ' removed', () => { restore('events', evs); restore('family', fam); });
      });
    },
  });
}

function refresh() {
  if (!root) return;
  const fam = getData().family;
  $('#memberList', root).innerHTML = fam.map(m => {
    const c = PALETTE[m.color] || PALETTE.clay;
    return '<div class="member-row" data-member="' + esc(m.id) + '">' +
      '<span class="member-dot" style="background:' + c.soft + ';color:' + c.dot + '">' + icon(m.group ? 'users' : 'user-round', 20) + '</span>' +
      '<div class="member-main">' +
        '<input class="input name-input" data-name value="' + esc(m.name) + '" maxlength="24" aria-label="Name">' +
        (m.group ? '<p class="member-hint">Used for events the whole family shares.</p>' : '') +
      '</div>' +
      '<div class="swatches" role="radiogroup" aria-label="Color for ' + esc(m.name) + '">' +
        Object.keys(PALETTE).map(k => '<button class="swatch" role="radio" data-color="' + k + '" aria-checked="' + (k === m.color) + '" aria-label="' + PALETTE[k].name + '" style="--sw:' + PALETTE[k].dot + '"></button>').join('') +
      '</div>' +
      (m.group ? '<span class="member-spacer"></span>' : '<button class="icon-btn ghost" data-remove aria-label="Remove ' + esc(m.name) + '">' + icon('trash-2', 18) + '</button>') +
    '</div>';
  }).join('');
}

export default { mount, refresh, unmount() { root = null; } };
