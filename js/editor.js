// Add / edit / delete an event.
import { icon } from './icons.js';
import { $, $$, esc, openModal, toast } from './ui.js';
import { getData, mutate, snapshot, restore, uid } from './store.js';
import { PALETTE, REPEATS } from './events.js';
import { keyOf, parseKey, today, toMin, fromMin, nowMin, fmt } from './dates.js';

// opts: { id, on } to edit an existing event (on = the date key that was tapped),
//       or { date, start } to create one.
export function openEventEditor(opts = {}) {
  const data = getData();
  const existing = opts.id ? data.events.find(e => e.id === opts.id) : null;
  const dateKey = opts.date ? keyOf(opts.date) : keyOf(today());
  let start = opts.start;
  if (!start) start = dateKey === keyOf(today()) ? fromMin(Math.min(Math.ceil((nowMin() + 1) / 60) * 60, 22 * 60)) : '09:00';
  const ev = existing ? JSON.parse(JSON.stringify(existing)) : {
    title: '', date: dateKey, allDay: false, start, end: fromMin(toMin(start) + 60),
    who: ['family'], where: '', notes: '', repeat: 'none', until: '',
  };
  if (!ev.start) ev.start = '09:00';
  if (!ev.end) ev.end = fromMin(toMin(ev.start) + 60);
  const tappedOn = opts.on || ev.date;
  const members = data.family;

  const html =
    '<form class="ed" novalidate>' +
      '<div class="modal-head"><h2>' + (existing ? 'Edit event' : 'New event') + '</h2>' +
        '<button type="button" class="icon-btn ghost" data-close aria-label="Close">' + icon('x') + '</button></div>' +
      '<div class="modal-body">' +
        '<label class="field"><span>Title</span><input class="input" name="title" maxlength="80" value="' + esc(ev.title) + '" placeholder="What’s happening?"' + (existing ? '' : ' autofocus') + ' required></label>' +
        '<p class="field-error" id="edErr" hidden>Give the event a title.</p>' +
        '<div class="field"><span id="whoLbl">Who</span><div class="who" role="group" aria-labelledby="whoLbl">' +
          members.map(m => '<button type="button" class="who-btn" data-id="' + esc(m.id) + '" aria-pressed="' + (ev.who.indexOf(m.id) !== -1) + '">' +
            '<i style="background:' + (PALETTE[m.color] || PALETTE.clay).dot + '"></i>' + esc(m.name) + '</button>').join('') +
        '</div></div>' +
        '<div class="row2">' +
          '<label class="field"><span id="dateLbl">' + (ev.repeat !== 'none' ? 'First date' : 'Date') + '</span><input class="input" type="date" name="date" value="' + ev.date + '" required></label>' +
          '<div class="field"><span>All day</span><button type="button" class="switch" role="switch" name="allDay" aria-checked="' + !!ev.allDay + '" aria-label="All day"><i></i></button></div>' +
        '</div>' +
        '<div class="row2 times"' + (ev.allDay ? ' hidden' : '') + '>' +
          '<label class="field"><span>Starts</span><input class="input" type="time" name="start" value="' + ev.start + '" step="300"></label>' +
          '<label class="field"><span>Ends</span><input class="input" type="time" name="end" value="' + ev.end + '" step="300"></label>' +
        '</div>' +
        '<div class="row2">' +
          '<label class="field"><span>Repeat</span><select class="input" name="repeat">' +
            REPEATS.map(r => '<option value="' + r.id + '"' + (r.id === (ev.repeat || 'none') ? ' selected' : '') + '>' + r.label + '</option>').join('') +
          '</select></label>' +
          '<label class="field until"' + (ev.repeat === 'none' ? ' hidden' : '') + '><span>Ends on <em>(optional)</em></span><input class="input" type="date" name="until" value="' + (ev.until || '') + '"></label>' +
        '</div>' +
        '<label class="field"><span>Location</span><input class="input" name="where" maxlength="80" value="' + esc(ev.where) + '" placeholder="Optional"></label>' +
        '<label class="field"><span>Notes</span><textarea class="input" name="notes" rows="2" maxlength="500" placeholder="Optional">' + esc(ev.notes) + '</textarea></label>' +
        (existing && ev.repeat !== 'none' ? '<p class="hint">' + icon('repeat', 16) + 'Changes apply to every repeat of this event.</p>' : '') +
      '</div>' +
      '<div class="modal-foot">' +
        (existing ? '<button type="button" class="btn btn-danger-ghost" data-act="delete">' + icon('trash-2', 18) + 'Delete</button>' : '<span></span>') +
        '<div class="foot-right"><button type="button" class="btn btn-quiet" data-close>Cancel</button><button type="submit" class="btn btn-primary">Save</button></div>' +
      '</div>' +
      '<div class="modal-foot confirm" hidden>' +
        '<p>This event repeats. Delete which?</p>' +
        '<div class="foot-right"><button type="button" class="btn btn-quiet" data-act="del-one">Only ' + fmt(parseKey(tappedOn), { month: 'short', day: 'numeric' }) + '</button>' +
        '<button type="button" class="btn btn-danger" data-act="del-all">All repeats</button></div>' +
      '</div>' +
    '</form>';

  openModal({
    label: existing ? 'Edit event' : 'New event',
    html,
    cls: 'modal-ed',
    mount(modal, close) {
      const form = $('form', modal);
      const f = name => form.elements[name];
      let duration = Math.max(15, toMin(ev.end) - toMin(ev.start));

      $('.who', modal).addEventListener('click', e => {
        const b = e.target.closest('.who-btn'); if (!b) return;
        b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'));
      });
      const allDayBtn = $('[name="allDay"]', modal);
      allDayBtn.addEventListener('click', () => {
        const on = allDayBtn.getAttribute('aria-checked') !== 'true';
        allDayBtn.setAttribute('aria-checked', String(on));
        $('.times', modal).hidden = on;
      });
      f('start').addEventListener('change', () => {
        if (!f('start').value) return;
        f('end').value = fromMin(toMin(f('start').value) + duration);
      });
      f('end').addEventListener('change', () => {
        if (f('start').value && f('end').value) duration = Math.max(15, toMin(f('end').value) - toMin(f('start').value));
      });
      f('repeat').addEventListener('change', () => {
        const rep = f('repeat').value !== 'none';
        $('.until', modal).hidden = !rep;
        $('#dateLbl', modal).textContent = rep ? 'First date' : 'Date';
      });

      form.addEventListener('submit', e => {
        e.preventDefault();
        const title = f('title').value.trim();
        if (!title) { $('#edErr', modal).hidden = false; f('title').focus(); return; }
        const who = $$('.who-btn[aria-pressed="true"]', modal).map(b => b.dataset.id);
        const allDay = allDayBtn.getAttribute('aria-checked') === 'true';
        let s = f('start').value || '09:00', en = f('end').value || fromMin(toMin(s) + 60);
        if (toMin(en) <= toMin(s)) en = fromMin(toMin(s) + 60);
        const repeat = f('repeat').value;
        const until = repeat !== 'none' && f('until').value && f('until').value >= f('date').value ? f('until').value : '';
        const saved = {
          id: existing ? existing.id : uid(),
          title, who: who.length ? who : ['family'],
          date: f('date').value || ev.date, allDay, start: s, end: en,
          repeat, until, where: f('where').value.trim(), notes: f('notes').value.trim(),
          skip: existing && existing.skip && repeat !== 'none' ? existing.skip : [],
        };
        mutate(d => {
          const i = d.events.findIndex(x => x.id === saved.id);
          if (i === -1) d.events.push(saved); else d.events[i] = saved;
        });
        close();
        toast(existing ? 'Event updated' : 'Event added');
      });

      const removeAll = () => {
        const before = snapshot('events');
        mutate(d => { d.events = d.events.filter(x => x.id !== existing.id); });
        close();
        toast('Event deleted', () => restore('events', before));
      };
      modal.addEventListener('click', e => {
        const act = e.target.closest('[data-act]'); if (!act) return;
        const a = act.dataset.act;
        if (a === 'delete') {
          if (existing.repeat && existing.repeat !== 'none') {
            $$('.modal-foot', modal)[0].hidden = true;
            $('.confirm', modal).hidden = false;
            $('[data-act="del-one"]', modal).focus();
          } else removeAll();
        } else if (a === 'del-all') removeAll();
        else if (a === 'del-one') {
          const before = snapshot('events');
          mutate(d => {
            const x = d.events.find(y => y.id === existing.id);
            if (x) x.skip = (x.skip || []).concat(tappedOn);
          });
          close();
          toast('Removed from ' + fmt(parseKey(tappedOn), { weekday: 'long' }), () => restore('events', before));
        }
      });
    },
  });
}
