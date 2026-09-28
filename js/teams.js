/* ============================================================
   Teams & questions - shared by all team games
   ============================================================ */
(function () {
  'use strict';
  const ICG = window.ICG, h = ICG.h, S = ICG.sound;

  /* ----- The characters teams can choose -----
     picture : file name in images/characters/  (swap with your own .png/.jpg of the same name)
     team    : the team name it starts with
     faces   : which way the picture looks: 'left', 'right' or 'up-right'
               (so the games can turn it the right way) */
  const CHARACTERS = [
    { picture: 'rabbit', team: 'Rabbits', faces: 'left' },
    { picture: 'turtle', team: 'Turtles', faces: 'left' },
    { picture: 'rocket', team: 'Rockets', faces: 'up-right' },
    { picture: 'racing-car', team: 'Racers', faces: 'right' },
    { picture: 'lion', team: 'Lions', faces: 'left' },
    { picture: 't-rex', team: 'Dinos', faces: 'left' },
    { picture: 'snail', team: 'Snails', faces: 'left' },
    { picture: 'horse', team: 'Horses', faces: 'left' },
    { picture: 'penguin', team: 'Penguins', faces: 'right' },
    { picture: 'panda', team: 'Pandas', faces: 'right' }
  ];
  const COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
  const LIGHT = ['#fde2e2', '#dbe8fe', '#d7f5e1', '#fdeccc', '#ede4fe', '#fce1ef', '#d5f3f9', '#ecf8d4'];
  const OWN = '__own__';

  // winner-screen list: at most 3 lines (1 column up to 3 teams, 2 columns for 4, 3 columns for 5-8)
  ICG.rankCols = n => ({ gridTemplateColumns: 'repeat(' + (n <= 3 ? 1 : n === 4 ? 2 : 3) + ', minmax(0, 1fr))', maxWidth: n <= 3 ? '640px' : n === 4 ? '900px' : '1260px' });
  const T = (ICG.T = { CHARACTERS, COLORS, LIGHT, OWN });

  T.charOf = id => CHARACTERS.find(c => c.picture === id) || CHARACTERS[0];
  T.faceTransform = function (c, dir) {
    if (c.faces === 'up-right') return dir === 'right' ? 'rotate(45deg)' : 'scaleX(-1) rotate(45deg)';
    return c.faces === dir ? 'none' : 'scaleX(-1)';
  };
  T.charImg = function (id, dir, cls) {
    const c = T.charOf(id);
    const img = ICG.picture(c.picture, 'images/characters', cls);
    img.style.transform = T.faceTransform(c, dir || 'right');
    return img;
  };

  /* team names + characters are shared by all games (saved on this device) */
  T.loadTeams = function () {
    const def = [0, 1, 2, 3, 4, 5, 6, 7].map(i => ({ char: CHARACTERS[i].picture, name: CHARACTERS[i].team }));
    const old = (ICG.store.get('race.settings', {}) || {}).teams;
    const t = ICG.store.get('teams.list', null) || old;
    if (!Array.isArray(t) || !t.length) return def;
    // older saves had 4 teams: top up to 8 with unused characters
    const out = t.slice(0, 8);
    def.forEach(d => { if (out.length < 8 && !out.some(x => x.char === d.char)) out.push(d); });
    CHARACTERS.forEach(c => { if (out.length < 8 && !out.some(x => x.char === c.picture)) out.push({ char: c.picture, name: c.team }); });
    return out;
  };
  T.saveTeams = list => ICG.store.set('teams.list', list);
  T.makeTeams = function (list, n) {
    const cls = ICG.classes.current();
    const g = cls ? ICG.classes.groups(cls, n) : null;
    return list.slice(0, n).map((t, i) => ({ char: t.char, name: t.name, color: COLORS[i], light: LIGHT[i], members: g ? g[i] : [], out: [] }));
  };
  // options for the Pick wheel: players of the team whose turn it is + all teams
  T.wheelOpts = (teams, getTurn) => () => {
    const k = getTurn ? getTurn() : -1;
    return { teams: teams.map(t => ({ label: t.name, color: t.color })), players: k >= 0 ? { label: teams[k].name, team: teams[k] } : null };
  };
  // "Class: G2 (18 here)  [Change]  [Teams]" row for set-up screens
  T.classRow = function (n, teamList, changed) {
    const cls = ICG.classes.current();
    return h('div', { class: 'srow' }, h('div', { class: 'slabel' }, 'Class'),
      h('button', { class: 'chip on', onclick: () => ICG.classes.picker(changed) }, cls ? cls.name + ' (' + ICG.classes.present(cls).length + ' here)' : 'No class - just team names'),
      h('button', { class: 'chip', onclick: () => ICG.classes.picker(changed) }, 'Change'),
      cls ? h('button', { class: 'chip', onclick: () => ICG.classes.openTeams(n, T.makeTeams(teamList, n), changed) }, "Who's in each team?") : null);
  };

  /* ---------- setup-screen pieces ---------- */
  T.seg = function (options, value, onPick) {
    return h('div', { class: 'seg' }, options.map(([v, label]) =>
      h('button', { class: v === value ? 'on' : '', onclick: () => onPick(v) }, label)));
  };
  // team chips: tap character to change it, tap name to rename
  T.teamChips = function (teams, n, changed) {
    const box = h('div', { class: 'team-chips' + (n > 4 ? ' many' : '') });
    const cls = ICG.classes.current(), g = cls ? ICG.classes.groups(cls, n) : null;
    for (let i = 0; i < n; i++) {
      const t = teams[i];
      box.append(h('div', { class: 'team-chip', style: { borderColor: COLORS[i], background: LIGHT[i] } },
        h('button', { class: 'char-btn', title: 'Change character', onclick: () => {
          const used = teams.slice(0, n).map(x => x.char);
          let k = CHARACTERS.findIndex(c => c.picture === t.char);
          for (let m = 0; m < CHARACTERS.length; m++) { k = (k + 1) % CHARACTERS.length; if (!used.includes(CHARACTERS[k].picture)) break; }
          t.char = CHARACTERS[k].picture;
          t.name = CHARACTERS[k].team; // new character = its own team name (tap the name to rename)
          T.saveTeams(teams); changed();
        } }, T.charImg(t.char, 'right')),
        h('button', { class: 'name-btn', title: 'Rename team', onclick: () => ICG.ask('Team name', t.name, v => { t.name = v; T.saveTeams(teams); changed(); }) }, t.name),
        g ? h('span', { class: 'tc-count' }, g[i].length) : null));
    }
    return box;
  };
  T.teamHint = () => h('div', { class: 'small-note', style: { textAlign: 'left', margin: '-6px 0 0 232px', fontSize: '22px' } }, 'Tap a character to change it. Tap a name to rename the team.');

  // question pack chips. s.packs = list of pack ids (or [OWN])
  T.cleanPacks = function (packs) {
    if (!packs) packs = ICG.packs.length ? [ICG.packs[0].id] : [OWN];
    packs = packs.filter(p => p === OWN || ICG.packs.some(k => k.id === p));
    return packs.length ? packs : [OWN];
  };
  // setup row: a short summary of the chosen packs + a "Choose" button that opens all packs by group
  T.packChips = function (s, changed) {
    const chosen = ICG.packs.filter(p => s.packs.includes(p.id));
    const own = s.packs.includes(OWN);
    const row = h('div', { class: 'pack-chips' });
    if (own) row.append(h('div', { class: 'chip own on' }, ICG.picture('megaphone', 'images/app'), 'I ask my own questions'));
    else {
      chosen.slice(0, 3).forEach(p => row.append(h('div', { class: 'chip on' }, p.picture ? ICG.picture(p.picture) : null, p.title)));
      if (chosen.length > 3) row.append(h('div', { class: 'chip on' }, '+' + (chosen.length - 3) + ' more'));
    }
    row.append(h('button', { class: 'chip pick-packs', onclick: () => T.choosePacks(s, changed) }, 'Choose questions...'));
    return row;
  };
  T.choosePacks = function (s, changed) {
    const body = h('div', { class: 'packs-modal' });
    const groups = [];
    ICG.packs.forEach(p => { if (!groups.includes(p.group)) groups.push(p.group); });
    function render() {
      body.innerHTML = '';
      groups.forEach(g => {
        const list = ICG.packs.filter(p => p.group === g);
        const allOn = list.every(p => s.packs.includes(p.id));
        body.append(h('div', { class: 'pm-head' }, h('span', null, g),
          h('button', { class: 'chip', onclick: () => {
            s.packs = s.packs.filter(x => x !== OWN);
            if (allOn) s.packs = s.packs.filter(x => !list.some(p => p.id === x));
            else list.forEach(p => { if (!s.packs.includes(p.id)) s.packs.push(p.id); });
            if (!s.packs.length) s.packs = [OWN];
            render();
          } }, allOn ? 'None' : 'All')));
        body.append(h('div', { class: 'pack-chips' }, list.map(p => {
          const on = s.packs.includes(p.id);
          return h('button', { class: 'chip' + (on ? ' on' : ''), onclick: () => {
            s.packs = s.packs.filter(x => x !== OWN);
            if (on) s.packs = s.packs.filter(x => x !== p.id); else s.packs.push(p.id);
            if (!s.packs.length) s.packs = [OWN];
            render();
          } }, p.picture ? ICG.picture(p.picture) : null, p.title + ' (' + p.questions.length + ')');
        })));
      });
      body.append(h('div', { class: 'pm-head' }, h('span', null, 'No question list')));
      body.append(h('div', { class: 'pack-chips' }, h('button', { class: 'chip own' + (s.packs.includes(OWN) ? ' on' : ''), onclick: () => { s.packs = [OWN]; render(); } },
        ICG.picture('megaphone', 'images/app'), 'I ask my own questions')));
    }
    const m = ICG.modal([h('h2', null, 'Choose questions'), body,
      h('div', { class: 'row', style: { marginTop: '20px' } }, h('button', { class: 'btn big green', onclick: () => m.close() }, 'Done'))],
      { onClose: changed });
    m.box.style.width = '1450px';
    render();
  };
  T.buildDeck = function (s) {
    if (s.packs.includes(OWN)) return [];
    let qs = [];
    ICG.packs.filter(p => s.packs.includes(p.id)).forEach(p => { qs = qs.concat(p.questions); });
    if (s.level && s.level !== 'both') qs = qs.filter(q => q.level === s.level);
    return ICG.shuffle(qs);
  };
  // a deck that reshuffles itself when it runs out
  T.deck = function (s) {
    let list = T.buildDeck(s), i = -1;
    return {
      own: !list.length,
      next() { if (!list.length) return null; i++; if (i >= list.length) { list = ICG.shuffle(list); i = 0; } const nx = list[(i + 1) % list.length]; if (nx && nx.pic) ICG.preload(nx.pic); return list[i]; }
    };
  };

  /* ---------- question block (picture + text + show answer) ---------- */
  T.questionBlock = function (q, opts) {
    opts = opts || {};
    const wrap = h('div', { class: 'qb' });
    const main = h('div', { class: 'q-main' });
    if (!q) {
      main.append(ICG.picture('megaphone', 'images/app', 'q-pic'), h('div', { class: 'q-text', style: { fontSize: (opts.big || 52) + 'px' } }, "Teacher's question!"));
      wrap.append(main); return wrap;
    }
    if (q.pic) main.append(ICG.picture(q.pic, 'images', 'q-pic'));
    const len = q.q.length, base = opts.big || 54;
    const fs = len > 90 ? base * .6 : len > 60 ? base * .7 : len > 35 ? base * .85 : base;
    main.append(h('div', { class: 'q-text', style: { fontSize: fs + 'px' } }, q.q));
    wrap.append(main);
    if (q.a) {
      const ans = h('div', { class: 'answer' }, q.a);
      const btn = h('button', { class: 'btn white show-ans', onclick: () => { S.pop(); btn.replaceWith(ans); } }, 'Show answer');
      wrap.append(btn);
      wrap.showAnswer = () => { if (btn.isConnected) btn.click(); };
    }
    return wrap;
  };

  /* ---------- "who got it right?" buttons ---------- */
  T.awardButtons = function (teams, onTeam, onNobody, opts) {
    opts = opts || {};
    return h('div', { class: 'award-box' },
      h('div', { class: 'who' }, opts.label || 'Who got it right?'),
      h('div', { class: 'award-grid n' + teams.length },
        teams.map((tm, i) => h('button', { class: 'award', style: { background: tm.color }, onclick: () => onTeam(i) },
          T.charImg(tm.char, 'right', 'mini'), h('span', null, tm.name), opts.plus === false ? null : h('b', null, opts.plus || '+1')))),
      onNobody ? h('button', { class: 'btn grey nobody', onclick: onNobody }, opts.nobody || 'Nobody - next question') : null);
  };

  /* ---------- scoreboard ---------- */
  T.scoreboard = function (teams) {
    const rows = teams.map(t => {
      const val = h('div', { class: 'sb-score' }, '0');
      const row = h('button', { class: 'sb-row', style: { background: t.light, borderColor: t.color }, onclick: () => ICG.classes.showMembers(t) },
        T.charImg(t.char, 'right', 'sb-char'), h('div', { class: 'sb-name' }, t.name), val);
      return { row, val };
    });
    const el = h('div', { class: 'scoreboard' }, rows.map(r => r.row));
    return {
      el,
      update(scores, turn, bumped) {
        rows.forEach((r, i) => {
          if (r.val.textContent !== String(scores[i])) { r.val.textContent = scores[i]; r.val.classList.remove('bump'); void r.val.offsetWidth; r.val.classList.add('bump'); }
          r.row.classList.toggle('turn', i === turn);
        });
      }
    };
  };

  /* ---------- winner screen ---------- */
  T.celebrate = function (teams, scores, opts) {
    opts = opts || {};
    S.win(); ICG.confetti(4000);
    const best = Math.max(...scores);
    const winners = teams.filter((t, i) => scores[i] === best);
    const order = teams.map((tm, i) => ({ tm, p: scores[i] })).sort((a, b) => b.p - a.p);
    const m = ICG.modal([
      h('div', { class: 'win-top' }, ICG.picture('trophy', 'images/app', 'win-trophy'), winners.length <= 3 ? winners.map(w => T.charImg(w.char, 'right', 'win-char')) : null),
      h('h2', { style: { fontSize: '80px', margin: '6px 0 10px', color: winners.length > 1 ? 'var(--ink)' : winners[0].color } }, winners.length > 1 ? "It's a tie!" : winners[0].name + ' win!'),
      h('div', { class: 'ranking', style: ICG.rankCols(order.length) }, order.map((o, k) =>
        h('div', { class: 'rank-row' }, h('b', null, (k + 1) + '.'), T.charImg(o.tm.char, 'right', 'mini'), h('span', null, o.tm.name), h('span', { class: 'rp' }, o.p + (o.p === 1 ? (opts.unit || ' points').replace(/s$/, '') : (opts.unit || ' points')))))),
      h('div', { class: 'row', style: { marginTop: '24px' } },
        h('button', { class: 'btn big green', onclick: () => { m.close(); opts.again && opts.again(); } }, 'Play again'),
        h('button', { class: 'btn big white', onclick: () => { m.close(); opts.settings && opts.settings(); } }, 'Settings'),
        h('button', { class: 'btn big grey', onclick: () => { m.close(); location.hash = ''; } }, 'Home'))
    ], { sticky: true });
    m.box.style.textAlign = 'center'; m.box.style.minWidth = '1000px';
    return m;
  };
})();

/* ============================================================
   Guess checker - the game decides if a guess is right,
   without showing the answer on the TV.
   The teacher taps the word the student said.
   ============================================================ */
(function () {
  'use strict';
  const ICG = window.ICG, h = ICG.h, S = ICG.sound, T = ICG.T;

  const norm = s => String(s || '').toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim().replace(/^(a|an|the|it s|its|it is) /, '');
  const forms = s => { const n = norm(s); return [n, n.replace(/ies$/, 'y'), n.replace(/es$/, ''), n.replace(/s$/, ''), n.replace(/ /g, '')]; };
  T.answerMatches = function (word, guess) {
    const ok = [word.name, word.pic.replace(/-/g, ' ')].concat(word.also || []);
    const g = forms(guess);
    return ok.some(a => forms(a).some(f => f && g.includes(f)));
  };
  // every name any picture can have (so suggestions never give the answer away)
  function allNames() {
    const set = new Set();
    ICG.pictureSets.forEach(p => p.words.forEach(w => [w.name].concat(w.also || []).forEach(n => set.add(norm(n)))));
    return [...set].filter(Boolean).sort();
  }

  T.guessCheck = function (word, teamName, done) {
    let typed = '';
    const names = allNames();
    const shown = h('div', { class: 'gc-typed' });
    const sugg = h('div', { class: 'gc-sugg' });
    const keys = h('div', { class: 'gc-keys' });
    const m = ICG.modal([
      h('h2', null, (teamName ? teamName + ' - ' : '') + 'what did they say?'),
      h('div', { class: 'small-note', style: { textAlign: 'left', marginBottom: '10px' } }, 'Tap the first letters, then tap their word.'),
      shown, sugg, keys,
      h('div', { class: 'row', style: { marginTop: '14px' } },
        h('button', { class: 'btn grey', onclick: () => m.close() }, 'Cancel'),
        h('button', { class: 'btn green', onclick: () => typed.trim() && check(typed) }, 'Check this word'))
    ], { sticky: true });
    m.box.style.width = '1450px';

    function render() {
      shown.textContent = typed || ' ';
      sugg.innerHTML = '';
      const t = norm(typed);
      if (t) names.filter(n => n.startsWith(t) || n.split(' ').some(p => p.startsWith(t))).slice(0, 12)
        .forEach(n => sugg.append(h('button', { class: 'chip', onclick: () => check(n) }, n)));
      else sugg.append(h('div', { class: 'small-note' }, 'Words will appear here'));
    }
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach(ch => keys.append(h('button', { class: 'gc-key', onclick: () => { typed += ch.toLowerCase(); S.tick(); render(); } }, ch)));
    keys.append(h('button', { class: 'gc-key wide', onclick: () => { typed += ' '; render(); } }, 'space'));
    keys.append(h('button', { class: 'gc-key wide', onclick: () => { typed = typed.slice(0, -1); render(); } }, '⌫'));
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    const onKey = e => {
      e.stopPropagation();
      if (e.key === 'Enter') e.preventDefault(); // don't press the button behind
      if (/^[a-z]$/i.test(e.key)) { typed += e.key.toLowerCase(); render(); }
      else if (e.key === 'Backspace') { typed = typed.slice(0, -1); render(); }
      else if (e.key === ' ') { e.preventDefault(); typed += ' '; render(); }
      else if (e.key === 'Enter' && typed.trim()) check(typed);
    };
    document.addEventListener('keydown', onKey, true);
    const close0 = m.close; m.close = () => { document.removeEventListener('keydown', onKey, true); close0(); };

    function check(g) {
      const right = T.answerMatches(word, g);
      m.box.innerHTML = '';
      m.box.append(h('div', { class: 'gc-result ' + (right ? 'yes' : 'no') },
        h('div', { class: 'gc-mark' }, right ? '✓' : '✗'),
        h('div', { class: 'gc-word' }, '"' + norm(g) + '"'),
        h('div', { class: 'gc-say' }, right ? 'Right!' : 'Not quite!')));
      m.box.style.width = '900px';
      right ? S.correct() : S.nobody();
      setTimeout(() => { m.close(); done(right); }, 1700);
    }
    render();
  };
})();
