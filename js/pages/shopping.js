// Shopping list: add items, tap to check off, clear checked (with Undo).
import { icon } from '../icons.js';
import { $, esc, plural, toast } from '../ui.js';
import { getData, mutate, snapshot, restore, uid } from '../store.js';

let root = null;
let justAdded = null;

function mount(el) {
  root = el;
  el.innerHTML =
    '<div class="page-head">' +
      '<div><h1>Shopping List</h1><p id="shopSub"></p></div>' +
      '<div class="ph-actions"><button class="btn btn-quiet" id="clearChecked">Clear checked</button></div>' +
    '</div>' +
    '<section class="card list-card">' +
      '<form class="add-row" id="shopForm" autocomplete="off">' +
        '<input class="input" name="itemName" placeholder="Add an item…" maxlength="60" enterkeyhint="done" aria-label="New item">' +
        '<button class="btn btn-primary" type="submit">' + icon('plus', 18) + 'Add</button>' +
      '</form>' +
      '<div class="shop-grid" id="shopGrid"></div>' +
    '</section>';
  $('#shopForm', el).addEventListener('submit', e => {
    e.preventDefault();
    const input = e.target.elements.itemName, name = input.value.trim();
    if (!name) { input.focus(); return; }
    const item = { id: uid(), name: name.charAt(0).toUpperCase() + name.slice(1), note: '', done: false, at: Date.now() };
    justAdded = item.id;
    input.value = '';
    mutate(d => { d.shopping.unshift(item); });
  });
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-shop]');
    if (b) {
      const id = b.dataset.shop;
      mutate(d => { const it = d.shopping.find(x => x.id === id); if (it) it.done = !it.done; });
      return;
    }
    if (e.target.closest('#clearChecked')) {
      const before = snapshot('shopping');
      const n = getData().shopping.filter(i => i.done).length;
      mutate(d => { d.shopping = d.shopping.filter(i => !i.done); });
      toast('Cleared ' + plural(n, 'item'), () => restore('shopping', before));
    }
  });
  refresh();
}

function refresh() {
  if (!root) return;
  const items = getData().shopping;
  const done = items.filter(i => i.done).length;
  $('#shopSub', root).textContent = items.length ? (items.length - done) + ' to get · ' + done + ' checked' : 'Nothing on the list';
  $('#clearChecked', root).disabled = !done;
  $('#shopGrid', root).innerHTML = items.length
    ? items.map(it =>
        '<button class="shop-item' + (it.done ? ' done' : '') + (it.id === justAdded ? ' pop' : '') + '" data-shop="' + esc(it.id) + '" role="checkbox" aria-checked="' + it.done + '">' +
          '<span class="cbox lg">' + icon('check', 18) + '</span>' +
          '<span class="shop-text"><b>' + esc(it.name) + '</b>' + (it.note ? '<span>' + esc(it.note) + '</span>' : '') + '</span>' +
        '</button>').join('')
    : '<p class="empty">All set. Add something above when you need it.</p>';
  justAdded = null;
}

export default { mount, refresh, unmount() { root = null; } };
