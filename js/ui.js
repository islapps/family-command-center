// Small UI helpers shared by every page: selectors, escaping, toast, modal, popover.

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
export const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const plural = (n, word, many) => n + ' ' + (n === 1 ? word : (many || word + 's'));
export const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const isPhone = () => window.matchMedia('(max-width: 767px)').matches;

/* ---------- Toast with optional Undo ---------- */
let toastTimer = null;
let undoFn = null;

export function toast(message, undo) {
  const el = $('#toast');
  $('#toastMsg', el).textContent = message;
  undoFn = undo || null;
  $('#toastUndo', el).hidden = !undo;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, 5000);
}
function hideToast() { $('#toast').classList.remove('show'); undoFn = null; }
document.addEventListener('click', e => {
  if (e.target.closest('#toastUndo')) { if (undoFn) undoFn(); clearTimeout(toastTimer); hideToast(); }
});

/* ---------- Modal (centered on tablet, bottom sheet on phone) ---------- */
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function openModal({ label, html, mount, onClose, cls }) {
  closePopover();
  const wrap = document.createElement('div');
  wrap.className = 'modal-wrap';
  wrap.innerHTML = '<div class="modal' + (cls ? ' ' + cls : '') + '" role="dialog" aria-modal="true" aria-label="' + esc(label) + '">' + html + '</div>';
  document.body.appendChild(wrap);
  const modal = wrap.firstElementChild;
  const previous = document.activeElement;

  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key !== 'Tab') return;
    const items = $$(FOCUSABLE, modal).filter(el => el.getClientRects().length);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  function close() {
    if (!wrap.isConnected || wrap.dataset.closing) return;
    wrap.dataset.closing = '1';
    wrap.classList.remove('show');
    document.removeEventListener('keydown', onKey);
    setTimeout(() => wrap.remove(), reduceMotion() ? 0 : 200);
    if (previous && previous.focus && previous.isConnected) previous.focus({ preventScroll: true });
    if (onClose) onClose();
  }
  wrap.addEventListener('click', e => { if (e.target === wrap || e.target.closest('[data-close]')) close(); });
  document.addEventListener('keydown', onKey);
  requestAnimationFrame(() => wrap.classList.add('show'));
  if (mount) mount(modal, close);
  if (!modal.contains(document.activeElement)) {
    const first = $('[autofocus]', modal) || $$(FOCUSABLE, modal)[0];
    if (first) first.focus({ preventScroll: true });
  }
  return { modal, close };
}

/* ---------- Popover anchored to a button ---------- */
let pop = null;

export function closePopover() {
  if (!pop) return;
  pop.el.remove();
  document.removeEventListener('pointerdown', pop.outside, true);
  document.removeEventListener('keydown', pop.key);
  if (pop.anchor) pop.anchor.setAttribute('aria-expanded', 'false');
  pop = null;
}

export function openPopover(anchor, html, mount, opts = {}) {
  const reopen = pop && pop.anchor === anchor;
  closePopover();
  if (reopen) return; // second tap on the same anchor closes it
  const el = document.createElement('div');
  el.className = 'popover' + (opts.cls ? ' ' + opts.cls : '');
  el.setAttribute('role', 'dialog');
  if (opts.label) el.setAttribute('aria-label', opts.label);
  el.innerHTML = html;
  document.body.appendChild(el);
  const r = anchor.getBoundingClientRect();
  const w = el.offsetWidth;
  let left = opts.align === 'start' ? r.left : r.left + r.width / 2 - w / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
  el.style.left = left + 'px';
  el.style.top = (r.bottom + 8) + 'px';
  anchor.setAttribute('aria-expanded', 'true');
  const outside = e => { if (!el.contains(e.target) && !anchor.contains(e.target)) closePopover(); };
  const key = e => { if (e.key === 'Escape') { closePopover(); anchor.focus(); } };
  document.addEventListener('pointerdown', outside, true);
  document.addEventListener('keydown', key);
  pop = { el, anchor, outside, key };
  if (mount) mount(el, closePopover);
  return el;
}
