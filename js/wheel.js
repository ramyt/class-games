/* ============================================================
   Spin the Wheel - the wheel itself, the student name list,
   the pop-up picker used inside every game, and the
   stand-alone "Spin the Wheel" game.
   ============================================================ */
(function () {
  'use strict';
  const ICG = window.ICG, h = ICG.h, S = ICG.sound;

  /* ---------- student names: from the class in use (see js/classes.js) ---------- */
  const numbers = n => Array.from({ length: n }, (_, i) => String(i + 1));
  const outKey = () => { const c = ICG.classes.current(); return 'names.out.' + (c ? c.name : '_numbers'); };
  const N = (ICG.names = {
    all() { const c = ICG.classes.current(); const p = c ? ICG.classes.present(c) : []; return p.length ? p : numbers(20); },
    out() { return ICG.store.get(outKey(), []); },
    remaining() {
      const out = N.out().slice();
      return N.all().filter(n => { const i = out.indexOf(n); if (i >= 0) { out.splice(i, 1); return false; } return true; });
    },
    markOut(n) { const o = N.out(); o.push(n); ICG.store.set(outKey(), o); },
    reset() { ICG.store.set(outKey(), []); },
    label() { const c = ICG.classes.current(); return c ? c.name : 'Numbers 1-20'; },
    autoRemove() { return ICG.store.get('wheel.autoRemove', true); },
    setAutoRemove(v) { ICG.store.set('wheel.autoRemove', !!v); }
  });

  /* ---------- the wheel drawing ---------- */
  const COLS = ['#ef4444', '#f59e0b', '#facc15', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];
  const DARK_TEXT = ['#facc15', '#f59e0b', '#06b6d4'];

  ICG.makeWheel = function (onSpinTap) {
    const SZ = 1200, C = SZ / 2, R = C - 12;
    const canvas = h('canvas', { width: SZ, height: SZ });
    const pointer = h('div', { class: 'wheel-pointer' });
    const hub = h('div', { class: 'wheel-hub' }, 'SPIN');
    const el = h('div', { class: 'wheel-wrap' }, pointer, canvas, hub);
    const ctx = canvas.getContext('2d');
    let entries = [], colors = [], rot = 0, busy = false;

    function colorsFor(n) {
      let k = COLS.length;
      if (n > 1 && n % k === 1) k = 7; // stop first & last slice having the same colour
      return Array.from({ length: n }, (_, i) => (entries[i] && entries[i].color) || COLS[i % k]);
    }
    function draw() {
      ctx.clearRect(0, 0, SZ, SZ);
      const n = entries.length;
      ctx.save(); ctx.translate(C, C);
      ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
      if (!n) {
        ctx.fillStyle = '#d7d9ea'; ctx.beginPath(); ctx.arc(0, 0, R - 10, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#6b7090'; ctx.font = 'bold 60px Fredoka, sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('No names left', 0, -200); ctx.restore(); return;
      }
      const seg = Math.PI * 2 / n;
      ctx.rotate(rot);
      for (let i = 0; i < n; i++) {
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R - 10, i * seg, (i + 1) * seg); ctx.closePath();
        ctx.fillStyle = colors[i]; ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = n > 1 ? 5 : 0; if (n > 1) ctx.stroke();
        // label
        ctx.save(); ctx.rotate(i * seg + seg / 2);
        const label = entries[i].label;
        const maxW = R * 0.62;
        let fs = Math.min(84, n > 1 ? (2 * Math.PI * R * 0.62 / n) * 0.8 : 84);
        ctx.font = 'bold ' + fs + 'px Fredoka, sans-serif';
        while (ctx.measureText(label).width > maxW && fs > 18) { fs -= 2; ctx.font = 'bold ' + fs + 'px Fredoka, sans-serif'; }
        ctx.fillStyle = DARK_TEXT.includes(colors[i]) ? '#2a2140' : '#fff';
        ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        ctx.fillText(label, R - 50, 0);
        ctx.restore();
      }
      ctx.restore();
      // rim dots
      ctx.save(); ctx.translate(C, C);
      ctx.lineWidth = 16; ctx.strokeStyle = '#ffcc33'; ctx.beginPath(); ctx.arc(0, 0, R - 4, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    function indexAtPointer(r) {
      const n = entries.length, seg = Math.PI * 2 / n;
      let rel = (-Math.PI / 2 - r) % (Math.PI * 2); if (rel < 0) rel += Math.PI * 2;
      return Math.floor(rel / seg) % n;
    }
    const api = {
      el,
      get busy() { return busy; },
      setEntries(list) {
        entries = list.map(x => (typeof x === 'string' ? { label: x } : x));
        colors = colorsFor(entries.length); draw();
      },
      spin(done) {
        const n = entries.length;
        if (busy || !n) return;
        busy = true; S.ensure();
        const seg = Math.PI * 2 / n;
        const win = Math.floor(Math.random() * n);
        const rel = (win + 0.5 + (Math.random() - 0.5) * 0.7) * seg;
        let target = -Math.PI / 2 - rel;
        let delta = (target - rot) % (Math.PI * 2); if (delta < 0) delta += Math.PI * 2;
        const start = rot, total = delta + Math.PI * 2 * (5 + Math.floor(Math.random() * 3));
        const dur = 4800 + Math.random() * 1200, t0 = performance.now();
        let last = indexAtPointer(rot);
        (function frame(now) {
          const p = Math.min(1, (now - t0) / dur);
          const e = 1 - Math.pow(1 - p, 4);
          rot = start + total * e; draw();
          const idx = indexAtPointer(rot);
          if (idx !== last) { last = idx; S.tick(); pointer.classList.remove('tick'); void pointer.offsetWidth; pointer.classList.add('tick'); }
          if (p < 1) requestAnimationFrame(frame);
          else { busy = false; rot = rot % (Math.PI * 2); S.pop(); done && done(entries[win], win); }
        })(t0);
      }
    };
    const tap = () => onSpinTap ? onSpinTap() : api.spin();
    canvas.addEventListener('click', tap); hub.addEventListener('click', tap);
    draw();
    return api;
  };

  /* ---------- edit the student names ---------- */
  // choose which class the wheel uses
  ICG.editNames = function (onSaved) { ICG.classes.picker(() => onSaved && onSaved()); };

  /* ---------- pop-up wheel (used in every game) ----------
     opts can also be a function that returns the options
     opts.teams   : [{label, color}]  -> adds a "Teams" tab
     opts.players : {label, color, team} -> adds a tab to pick a player from that team
     opts.entries : ['a','b']          -> custom list only (no tabs, nothing removed)
     opts.title   : heading
     opts.onPick  : function(entry, closeFn) -> return a button element to show under the result */
  ICG.openWheel = function (opts) {
    if (typeof opts === 'function') opts = opts();
    opts = opts || {};
    const pl = opts.players && opts.players.team && opts.players.team.members && opts.players.team.members.length ? opts.players : null;
    let mode = opts.entries ? 'custom' : (opts.startTab || (pl ? 'players' : 'students'));
    const wheel = ICG.makeWheel(() => doSpin());
    const picked = h('div', { class: 'picked-box hint' }, 'Tap SPIN!');
    const note = h('div', { class: 'small-note' });
    const actions = h('div', { class: 'row' });
    const spinBtn = h('button', { class: 'btn big yellow', onclick: () => doSpin() }, 'SPIN');
    const tabs = h('div', { class: 'tabs' });
    let lastPick = null;

    function entries() {
      if (mode === 'custom') return opts.entries;
      if (mode === 'teams') return opts.teams;
      if (mode === 'players') {
        const t = pl.team; t.out = t.out || [];
        let left = t.members.filter(n => !t.out.includes(n));
        if (!left.length) { t.out = []; left = t.members.slice(); }
        return left.map(n => ({ label: n, color: null }));
      }
      return N.remaining();
    }
    function refresh() {
      tabs.innerHTML = '';
      if (mode !== 'custom') {
        const t = (id, label) => h('button', { class: mode === id ? 'on' : '', onclick: () => { mode = id; picked.className = 'picked-box hint'; picked.textContent = 'Tap SPIN!'; refresh(); } }, label);
        if (pl) tabs.append(t('players', pl.label));
        tabs.append(t('students', ICG.classes.current() ? 'Whole class' : 'Numbers'));
        if (opts.teams && opts.teams.length) tabs.append(t('teams', 'Teams'));
      }
      tabs.style.display = tabs.children.length > 1 ? '' : 'none';
      wheel.setEntries(entries());
      actions.innerHTML = '';
      note.textContent = '';
      if (mode === 'students') {
        const left = N.remaining().length, all = N.all().length;
        note.textContent = left + ' of ' + all + ' left on the wheel' + (N.autoRemove() ? ' (picked names are taken off)' : '');
        actions.append(
          h('button', { class: 'btn white', style: { fontSize: '28px', minHeight: '70px', padding: '0 24px' }, onclick: () => ICG.editNames(refresh) }, 'Class: ' + N.label()),
        );
        if (left < all) actions.append(h('button', { class: 'btn white', style: { fontSize: '28px', minHeight: '70px', padding: '0 24px' }, onclick: () => { N.reset(); refresh(); } }, 'Everyone back'));
        if (!left) { picked.className = 'picked-box hint'; picked.textContent = 'Everyone has had a turn! Tap "Everyone back".'; }
      }
    }
    function doSpin() {
      if (wheel.busy || !entries().length) return;
      picked.className = 'picked-box hint'; picked.textContent = 'Spinning...';
      wheel.spin(entry => {
        lastPick = entry.label || entry;
        picked.className = 'picked-box pop'; picked.textContent = lastPick;
        ICG.confetti(1800);
        if (mode === 'players') { pl.team.out = pl.team.out || []; pl.team.out.push(lastPick); }
        if (mode === 'students' && N.autoRemove()) { N.markOut(lastPick); setTimeout(() => { refresh(); picked.className = 'picked-box pop'; picked.textContent = lastPick; }, 1400); }
        if (opts.onPick) { const b = opts.onPick(entry, m.close); if (b) { actions.innerHTML = ''; actions.append(b); } }
      });
    }
    const side = h('div', { class: 'side' },
      opts.title ? h('h2', { style: { margin: 0 } }, opts.title) : null,
      tabs, picked, spinBtn, note, actions);
    const m = ICG.modal([wheel.el, side], { cls: 'wheel-modal', onClose: opts.onClose });
    refresh();
    return m;
  };

  /* ---------- stand-alone game: Spin the Wheel ---------- */
  ICG.register('wheel', {
    title: 'Spin the Wheel', picture: 'ferris-wheel', desc: 'Pick a student at random',
    ready: true,
    mount(stage) {
      stage.className = 'wheel-screen';
      const wheel = ICG.makeWheel(() => spin());
      const info = h('div', { class: 'info' });
      const tog = h('button', { class: 'toggle' + (N.autoRemove() ? ' on' : ''), onclick: () => { N.setAutoRemove(!N.autoRemove()); tog.classList.toggle('on', N.autoRemove()); } },
        h('span', { class: 'sw' }), h('span', null, 'Take picked names off the wheel'));
      const backBtn = h('button', { class: 'btn white', onclick: () => { N.reset(); refresh(); ICG.toast('Everyone is back on the wheel'); } }, 'Everyone back');
      const classBtn = h('button', { class: 'btn white', onclick: () => ICG.editNames(refresh) });
      function refresh() {
        classBtn.textContent = 'Class: ' + N.label();
        const left = N.remaining().length, all = N.all().length;
        wheel.setEntries(N.remaining());
        info.innerHTML = '<b>' + left + '</b> of ' + all + ' names on the wheel';
        backBtn.disabled = left === all;
      }
      function spin() {
        if (wheel.busy) return;
        if (!N.remaining().length) { ICG.toast('Everyone has had a turn! Tap "Everyone back".'); return; }
        wheel.spin(entry => {
          const name = entry.label;
          ICG.confetti(2500); S.win();
          const m = ICG.modal([
            h('div', { class: 'small-note', style: { fontSize: '36px' } }, "It's..."),
            h('div', { class: 'result-name' }, name),
            h('div', { class: 'row' }, h('button', { class: 'btn big green', onclick: () => m.close() }, 'OK'))
          ], { onClose: () => { if (N.autoRemove()) N.markOut(name); refresh(); } });
          m.box.style.minWidth = '900px'; m.box.style.textAlign = 'center';
        });
      }
      stage.append(
        ICG.topbar('Spin the Wheel', { noWheel: true }),
        wheel.el,
        h('div', { class: 'wheel-side' },
          h('button', { class: 'btn big yellow', style: { minHeight: '150px', fontSize: '64px' }, onclick: spin }, 'SPIN!'),
          info, tog,
          h('div', { class: 'row', style: { display: 'flex', gap: '20px' } },
            classBtn, backBtn)
        )
      );
      refresh();
    }
  });
})();
