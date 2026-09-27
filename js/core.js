/* ============================================================
   Class Games - core helpers shared by every game
   (you normally don't need to edit this file)
   ============================================================ */
(function () {
  'use strict';
  const ICG = (window.ICG = window.ICG || {});
  ICG.games = ICG.games || {};
  ICG.gameOrder = ICG.gameOrder || [];

  /* ---------- safety net: never show "null" when a button is left out ---------- */
  ['append', 'prepend'].forEach(fn => {
    const orig = Element.prototype[fn];
    Element.prototype[fn] = function (...items) { return orig.apply(this, items.filter(x => x != null && x !== false)); };
  });

  /* ---------- tiny DOM helper ---------- */
  ICG.h = function (tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'html') el.innerHTML = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    kids.flat().forEach(c => { if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(c)); });
    return el;
  };
  const h = ICG.h;

  /* ---------- saved settings (this browser only) ---------- */
  ICG.store = {
    get(k, d) { try { const v = localStorage.getItem('icg.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('icg.' + k, JSON.stringify(v)); } catch (e) {} }
  };

  ICG.possessive = n => n + (/s$/i.test(n) ? "'" : "'s");
  ICG.shuffle = function (a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  /* ---------- icons (simple inline SVG) ---------- */
  const I = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>',
    full: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
    exitfull: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>',
    sound: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9a4 4 0 010 6M18.5 6.5a8 8 0 010 11"/></svg>',
    mute: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>',
    wheel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4"/><circle cx="12" cy="12" r="2.2" fill="currentColor"/></svg>',
    undo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 010 12h-3"/></svg>',
    restart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 109-9 9 9 0 00-6.4 2.6L3 8"/><path d="M3 3v5h5"/></svg>',
    settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2" fill="#fff"/><circle cx="15" cy="12" r="2" fill="#fff"/><circle cx="8" cy="18" r="2" fill="#fff"/></svg>'
  };
  ICG.icon = n => I[n] || '';

  /* ---------- pictures ----------
     A picture called "cow" is looked for in this order:
       images/cow.png  ->  images/cow.jpg  ->  images/cow.jpeg  ->  images/cow.webp (built-in)
     So to swap a picture, just drop your own cow.png or cow.jpg into the images folder. */
  const EXTS = ['png', 'jpg', 'jpeg', 'webp'];
  const found = {};
  ICG.picture = function (name, folder, cls) {
    folder = folder || 'images';
    const img = h('img', { class: cls || '', alt: name, draggable: 'false' });
    const key = folder + '/' + name;
    if (found[key]) { img.src = found[key]; return img; }
    let i = 0;
    const tryNext = () => {
      if (i >= EXTS.length) { img.style.visibility = 'hidden'; return; }
      img.src = key + '.' + EXTS[i++];
    };
    img.onerror = tryNext;
    img.onload = () => { found[key] = img.src; img.onerror = null; };
    tryNext();
    return img;
  };
  ICG.preload = (name, folder) => { if (name) ICG.picture(name, folder); };

  /* ---------- question packs ---------- */
  ICG.packs = ICG.packs || [];
  window.addPack = function (p) {
    const qs = [];
    let level = 'easy';
    String(p.text || '').split(/\r?\n/).forEach(raw => {
      const line = raw.trim();
      if (!line || line.startsWith('//')) return;
      if (line.startsWith('#')) { level = /hard/i.test(line) ? 'harder' : 'easy'; return; }
      const parts = line.split('|').map(s => s.trim());
      let [q, a, pic] = parts;
      if (!q && pic) q = 'What is this?';
      if (!q) return;
      qs.push({ q, a: a || '', pic: pic || '', level });
    });
    ICG.packs.push({ id: p.id || p.title, title: p.title || 'Questions', picture: p.picture || '', group: p.group || 'General', questions: qs });
  };

  /* ---------- picture sets (for picture games) ----------
     words: "cat, dog, ice-cream" -> file names in the images folder.
     The name shown is the file name with - turned into a space.
     To show a different name, write  file=Name  e.g.  t-rex=dinosaur
     Other answers that also count go after a /  e.g.  dog=dog/puppy */
  ICG.pictureSets = ICG.pictureSets || [];
  window.addPictures = function (p) {
    const words = String(p.words || '').split(/[,\n]/).map(w => w.trim()).filter(Boolean).map(w => {
      const [file, rest] = w.split('=').map(x => x.trim());
      const names = (rest || '').split('/').map(x => x.trim()).filter(Boolean);
      return { pic: file, name: names[0] || file.replace(/-/g, ' '), also: names.slice(1) };
    });
    ICG.pictureSets.push({ id: p.id || p.title, title: p.title || 'Pictures', picture: p.picture || (words[0] && words[0].pic), group: p.group || '', words });
  };

  /* ---------- sounds (made in the browser, no files needed) ---------- */
  const S = (ICG.sound = { muted: ICG.store.get('muted', false), ctx: null });
  S.ensure = function () {
    if (!S.ctx) { try { S.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
    if (S.ctx.state === 'suspended') S.ctx.resume();
    return S.ctx;
  };
  S.tone = function (freq, dur, opt) {
    if (S.muted) return; const c = S.ensure(); if (!c) return;
    opt = opt || {};
    const t = c.currentTime + (opt.at || 0);
    const o = c.createOscillator(), g = c.createGain();
    o.type = opt.type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (opt.to) o.frequency.exponentialRampToValueAtTime(opt.to, t + dur);
    const v = opt.vol == null ? 0.25 : opt.vol;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
  };
  S.tick = () => S.tone(1800, 0.03, { type: 'square', vol: 0.06 });
  S.correct = () => { S.tone(784, 0.14, { type: 'triangle', vol: .3 }); S.tone(1175, 0.28, { type: 'triangle', vol: .3, at: .12 }); };
  S.nobody = () => { S.tone(330, 0.18, { type: 'triangle', vol: .22 }); S.tone(247, 0.3, { type: 'triangle', vol: .22, at: .16 }); };
  S.hop = () => S.tone(300, 0.25, { type: 'sine', to: 900, vol: .22 });
  S.pop = () => S.tone(600, 0.12, { type: 'triangle', to: 1200, vol: .25 });
  S.win = () => { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => S.tone(f, i === 5 ? .6 : .18, { type: 'triangle', vol: .3, at: i * .14 })); };
  S.drum = () => { for (let i = 0; i < 10; i++) S.tone(120 + Math.random() * 30, 0.06, { type: 'square', vol: .08, at: i * .07 }); };

  /* ---------- stage scaling ---------- */
  ICG.scale = 1;
  function fit() {
    const st = document.getElementById('stage'); if (!st) return;
    const W = window.innerWidth, H = window.innerHeight;
    const sc = (ICG.scale = Math.min(W / 1600, H / 900));
    st.style.transform = 'translate(' + (W - 1600 * sc) / 2 + 'px,' + (H - 900 * sc) / 2 + 'px) scale(' + sc + ')';
  }
  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', () => setTimeout(fit, 250));

  /* ---------- full screen + keep screen awake ---------- */
  ICG.isFull = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  ICG.toggleFull = function () {
    const d = document.documentElement;
    if (!ICG.isFull()) {
      const p = (d.requestFullscreen || d.webkitRequestFullscreen || function () { return Promise.reject(); }).call(d, { navigationUI: 'hide' });
      Promise.resolve(p).then(() => {
        try { screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {}); } catch (e) {}
      }).catch(() => ICG.toast('Full screen is not available here. Tip: use "Add to Home screen" in the browser menu.'));
    } else {
      (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    }
  };
  const onFull = () => document.querySelectorAll('[data-full]').forEach(b => { b.innerHTML = ICG.icon(ICG.isFull() ? 'exitfull' : 'full'); });
  document.addEventListener('fullscreenchange', onFull);
  document.addEventListener('webkitfullscreenchange', onFull);

  let wakeLock = null;
  async function keepAwake() {
    try { if ('wakeLock' in navigator && !wakeLock && document.visibilityState === 'visible') { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } } catch (e) {}
  }
  document.addEventListener('visibilitychange', keepAwake);
  document.addEventListener('pointerdown', () => { keepAwake(); S.ensure(); }, { passive: true });

  /* ---------- top bar used by every game ---------- */
  ICG.topbar = function (title, opts) {
    opts = opts || {};
    const soundBtn = h('button', { class: 'iconbtn', title: 'Sound on/off', html: ICG.icon(S.muted ? 'mute' : 'sound') });
    soundBtn.onclick = () => { S.muted = !S.muted; ICG.store.set('muted', S.muted); soundBtn.innerHTML = ICG.icon(S.muted ? 'mute' : 'sound'); if (!S.muted) S.pop(); };
    const bar = h('div', { class: 'topbar' },
      opts.noHome ? null : h('button', { class: 'iconbtn', title: 'Home', html: ICG.icon('home'), onclick: () => ICG.confirmLeave(opts.leaveCheck) }),
      h('div', { class: 'title' }, title),
      opts.extra || null,
      opts.noWheel ? null : h('button', { class: 'iconbtn wide', title: 'Pick a student', html: ICG.icon('wheel') + '<span>Pick</span>', onclick: () => ICG.openWheel(opts.wheel || {}) }),
      soundBtn,
      h('button', { class: 'iconbtn', title: 'Full screen', 'data-full': '', html: ICG.icon(ICG.isFull() ? 'exitfull' : 'full'), onclick: ICG.toggleFull })
    );
    return bar;
  };
  ICG.confirmLeave = function (check) {
    if (check && check()) ICG.confirm('Leave this game?', 'The scores will be lost.', 'Leave', () => { location.hash = ''; });
    else location.hash = '';
  };

  /* ---------- modal, confirm, prompt, toast ---------- */
  ICG.modal = function (content, opts) {
    opts = opts || {};
    const back = h('div', { class: 'modal-back' });
    const box = h('div', { class: 'modal ' + (opts.cls || '') }, content);
    back.append(box);
    const close = () => { back.remove(); opts.onClose && opts.onClose(); };
    if (!opts.sticky) back.addEventListener('click', e => { if (e.target === back) close(); });
    document.getElementById('stage').append(back);
    return { close, box, back };
  };
  ICG.confirm = function (title, text, yesLabel, onYes) {
    const m = ICG.modal([
      h('h2', null, title), text ? h('p', null, text) : null,
      h('div', { class: 'row' },
        h('button', { class: 'btn grey', onclick: () => m.close() }, 'Cancel'),
        h('button', { class: 'btn red', onclick: () => { m.close(); onYes(); } }, yesLabel || 'Yes'))
    ], { cls: 'center' });
    m.box.style.textAlign = 'center';
  };
  ICG.ask = function (title, value, onOk) {
    const inp = h('input', { type: 'text', value: value || '', maxlength: 24 });
    const m = ICG.modal([
      h('h2', null, title), inp, h('div', { style: { height: '24px' } }),
      h('div', { class: 'row' },
        h('button', { class: 'btn grey', onclick: () => m.close() }, 'Cancel'),
        h('button', { class: 'btn green', onclick: () => { const v = inp.value.trim(); m.close(); if (v) onOk(v); } }, 'OK'))
    ]);
    m.box.style.width = '900px';
    setTimeout(() => inp.focus(), 50);
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { const v = inp.value.trim(); m.close(); if (v) onOk(v); } });
  };
  ICG.toast = function (msg, ms) {
    const t = h('div', { class: 'toast' }, msg);
    document.getElementById('stage').append(t);
    setTimeout(() => t.remove(), ms || 3500);
  };

  /* ---------- confetti ---------- */
  ICG.confetti = function (ms) {
    const stage = document.getElementById('stage');
    const cv = h('canvas', { class: 'confetti', width: 1600, height: 900 });
    stage.append(cv);
    const ctx = cv.getContext('2d');
    const cols = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ec4899', '#ffcc33'];
    const ps = Array.from({ length: 160 }, () => ({
      x: 800 + (Math.random() - .5) * 300, y: 500, vx: (Math.random() - .5) * 26, vy: -Math.random() * 26 - 8,
      r: Math.random() * Math.PI, vr: (Math.random() - .5) * .4, w: 14 + Math.random() * 12, c: cols[(Math.random() * cols.length) | 0]
    }));
    const end = performance.now() + (ms || 3200);
    (function frame(now) {
      ctx.clearRect(0, 0, 1600, 900);
      ps.forEach(p => { p.vy += .6; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.w / 4, p.w, p.w / 2); ctx.restore(); });
      if (now < end) requestAnimationFrame(frame); else cv.remove();
    })(performance.now());
  };

  /* ---------- screens / router ---------- */
  ICG.register = function (id, game) { ICG.games[id] = game; if (!ICG.gameOrder.includes(id)) ICG.gameOrder.push(id); };
  let current = null;
  function route() {
    const id = (location.hash || '').replace('#', '') || 'home';
    const g = ICG.games[id] || ICG.games.home;
    const stage = document.getElementById('stage');
    if (current && current.unmount) { try { current.unmount(); } catch (e) {} }
    stage.innerHTML = '';
    stage.className = '';
    current = g;
    g.mount(stage);
  }
  window.addEventListener('hashchange', route);

  ICG.start = function () {
    document.body.append(h('div', { id: 'rotate-hint' },
      h('div', { class: 'phone' }),
      h('div', null, 'Please turn your phone sideways'),
      h('button', { onclick: () => document.body.classList.add('allow-portrait') }, 'Keep it upright')));
    fit(); route();
    // never let the page scroll (e.g. when the phone keyboard opens)
    const vp = document.getElementById('viewport');
    vp.addEventListener('scroll', () => { vp.scrollTop = 0; vp.scrollLeft = 0; });
    window.addEventListener('scroll', () => window.scrollTo(0, 0));
    if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {});
    // after a tap/click, let go of the button so Space/Enter don't press it again
    document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('button'); if (b) setTimeout(() => b.blur(), 0); }, true);
    // laptop keyboard: F = full screen, W = wheel
    document.addEventListener('keydown', e => {
      if (e.target.matches('input, textarea')) return;
      if (e.key === 'f' || e.key === 'F') ICG.toggleFull();
      if (e.key === 'w' || e.key === 'W') { if (!document.querySelector('.modal-back')) ICG.openWheel({}); }
      if (e.key === 'Escape') { const m = document.querySelector('.modal-back'); if (m) m.click(); }
    });
  };
})();
