/* ============================================================
   Classes - student nicknames and teams
   - Class lists come from packs/classes.js (shared by every
     phone/laptop that opens the website)
   - Changes made in the app are kept on this device until you
     tap "Save for all devices" and upload the new classes.js
   ============================================================ */
(function () {
  'use strict';
  const ICG = window.ICG, h = ICG.h, S = ICG.sound;

  /* ---------- lists written in packs/classes.js ---------- */
  const FILE = [];
  const splitNames = t => (Array.isArray(t) ? t : String(t || '').split(/[,\n]/)).map(s => String(s).trim()).filter(Boolean);
  window.addClass = function (c) {
    if (!c || !c.name) return;
    const groups = {};
    if (c.teams) Object.keys(c.teams).forEach(n => { groups[n] = c.teams[n].map(splitNames); });
    FILE.push({ name: String(c.name), students: splitNames(c.students), groups });
  };
  const sig = c => JSON.stringify([c.students, c.groups]);

  const today = () => new Date().toISOString().slice(0, 10);
  const C = (ICG.classes = {});

  /* ---------- load / save ---------- */
  let data = null;
  function load() {
    if (data) return data;
    data = ICG.store.get('classes.v1', null) || { list: [], current: null, absent: {} };
    // first time: turn an old single name list into a class
    if (!data.list.length) {
      const old = ICG.store.get('names', null);
      if (Array.isArray(old) && old.length && !/^\d+$/.test(old[0])) data.list.push({ name: 'My class', students: old, groups: {}, edited: true });
    }
    // merge in the lists from classes.js
    FILE.forEach(f => {
      const local = data.list.find(c => c.name === f.name);
      if (!local) data.list.push({ name: f.name, students: f.students.slice(), groups: JSON.parse(JSON.stringify(f.groups)), fileSig: sig(f), edited: false });
      else if (!local.edited && local.fileSig !== sig(f)) Object.assign(local, { students: f.students.slice(), groups: JSON.parse(JSON.stringify(f.groups)), fileSig: sig(f) });
    });
    if (data.current && !data.list.some(c => c.name === data.current)) data.current = null;
    if (!data.absent || data.absent.date !== today()) data.absent = { date: today(), names: {} };
    return data;
  }
  function save() { ICG.store.set('classes.v1', data); }
  C.fileVersion = name => FILE.find(f => f.name === name);

  C.list = () => load().list;
  C.get = name => load().list.find(c => c.name === name) || null;
  C.current = () => (load().current ? C.get(data.current) : null);
  C.setCurrent = name => { load().current = name || null; save(); };
  C.absentOf = cls => (cls ? (load().absent.names[cls.name] || []) : []);
  C.toggleAbsent = (cls, n) => {
    const a = load().absent.names[cls.name] = C.absentOf(cls).slice();
    const i = a.indexOf(n); if (i >= 0) a.splice(i, 1); else a.push(n);
    save();
  };
  C.present = cls => { const a = C.absentOf(cls); return cls ? cls.students.filter(n => !a.includes(n)) : []; };
  C.touch = cls => { cls.edited = true; save(); };
  C.add = name => { load(); let n = name, k = 2; while (C.get(n)) n = name + ' ' + k++; data.list.push({ name: n, students: [], groups: {}, edited: true }); save(); return C.get(n); };
  C.remove = cls => { load(); data.list = data.list.filter(c => c !== cls); if (data.current === cls.name) data.current = null; save(); };
  C.rename = (cls, name) => { if (!name || C.get(name)) return false; if (data.current === cls.name) data.current = name; cls.name = name; C.touch(cls); return true; };
  C.setStudents = (cls, list) => { cls.students = list; C.touch(cls); };

  /* ---------- teams made from the class ---------- */
  C.groups = function (cls, n) {
    if (!cls) return null;
    const people = C.present(cls);
    const saved = cls.groups && cls.groups[n];
    if (!saved) return C.shuffle(cls, n, true);
    const g = Array.from({ length: n }, (_, i) => (saved[i] || []).filter(x => people.includes(x)));
    const placed = new Set([].concat(...g));
    people.filter(p => !placed.has(p)).forEach(p => { let s = 0; g.forEach((x, i) => { if (x.length < g[s].length) s = i; }); g[s].push(p); });
    return g;
  };
  C.shuffle = function (cls, n, quiet) {
    const people = ICG.shuffle(C.present(cls));
    const g = Array.from({ length: n }, () => []);
    people.forEach((p, i) => g[i % n].push(p));
    cls.groups = cls.groups || {}; cls.groups[n] = g;
    if (quiet) save(); else C.touch(cls);
    return g;
  };
  C.move = function (cls, n, name) {
    const g = C.groups(cls, n);
    const from = g.findIndex(x => x.includes(name));
    g[from] = g[from].filter(x => x !== name);
    g[(from + 1) % n].push(name);
    cls.groups[n] = g; C.touch(cls);
    return g;
  };

  /* ---------- save for all devices (download classes.js) ---------- */
  C.fileText = function () {
    const q = s => "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
    let out = '/* ============================================================\n' +
      '   CLASS LISTS  (nicknames)  -  made by the "Save for all devices" button\n' +
      '   To change a class: edit the names below, or change them in the app\n' +
      '   and save again. One addClass block per class.\n' +
      '   ============================================================ */\n\n';
    load().list.forEach(c => {
      out += 'addClass({\n  name: ' + q(c.name) + ',\n  students: `' + c.students.join(', ') + '`';
      const ks = Object.keys(c.groups || {});
      if (ks.length) {
        out += ',\n  teams: {\n' + ks.map(k => '    ' + k + ': [' + c.groups[k].map(g => q(g.join(', '))).join(', ') + ']').join(',\n') + '\n  }';
      }
      out += '\n});\n\n';
    });
    return out;
  };
  C.download = function () {
    const text = C.fileText();
    try {
      const a = h('a', { href: URL.createObjectURL(new Blob([text], { type: 'text/javascript' })), download: 'classes.js' });
      document.body.append(a); a.click(); a.remove();
      load().list.forEach(c => { c.edited = false; c.fileSig = sig(c); }); save();
      return true;
    } catch (e) { return false; }
  };
  C.importText = function (text) {
    const got = [];
    try { new Function('addClass', text)(c => got.push(c)); } catch (e) { return 0; }
    load();
    got.forEach(c => {
      const groups = {};
      if (c.teams) Object.keys(c.teams).forEach(n => { groups[n] = c.teams[n].map(splitNames); });
      const item = { name: String(c.name), students: splitNames(c.students), groups, edited: true };
      const i = data.list.findIndex(x => x.name === item.name);
      if (i >= 0) data.list[i] = item; else data.list.push(item);
    });
    save();
    return got.length;
  };

  /* ---------- small pieces used by the games ---------- */
  // "Class: G2 (18 here)" chooser shown on game set-up screens
  C.picker = function (changed) {
    const cls = C.current();
    const m = ICG.modal([
      h('h2', null, 'Which class?'),
      h('div', { class: 'class-pick' },
        h('button', { class: 'chip' + (!cls ? ' on' : ''), onclick: () => { C.setCurrent(null); m.close(); changed(); } }, 'No class (just team names)'),
        C.list().map(c => h('button', { class: 'chip' + (cls === c ? ' on' : ''), onclick: () => { C.setCurrent(c.name); m.close(); changed(); } },
          c.name + ' (' + C.present(c).length + ')'))),
      h('div', { class: 'row', style: { marginTop: '26px' } },
        h('button', { class: 'btn white', onclick: () => { m.close(); location.hash = 'classes'; } }, 'Edit classes'),
        h('button', { class: 'btn grey', onclick: () => m.close() }, 'Close'))
    ]);
    m.box.style.width = '1200px';
  };
  // show / change who is in each team
  C.teamsEditor = function (cls, n, teams, changed) {
    const box = h('div', { class: 'teams-edit' });
    function render(g) {
      box.innerHTML = '';
      g.forEach((names, i) => {
        const t = teams[i];
        box.append(h('div', { class: 'te-col', style: { borderColor: t.color, background: t.light } },
          h('div', { class: 'te-head', style: { background: t.color } }, ICG.T.charImg(t.char, 'right', 'mini'), h('span', null, t.name + ' (' + names.length + ')')),
          h('div', { class: 'te-names' }, names.map(nm => h('button', { class: 'te-name', title: 'Move to the next team', onclick: () => { S.pop(); render(C.move(cls, n, nm)); changed && changed(); } }, nm)))));
      });
    }
    render(C.groups(cls, n));
    return { el: box, shuffle() { render(C.shuffle(cls, n)); changed && changed(); } };
  };
  C.openTeams = function (n, teams, changed) {
    const cls = C.current(); if (!cls) return;
    const ed = C.teamsEditor(cls, n, teams, changed);
    const m = ICG.modal([
      h('h2', null, cls.name + ' - teams'),
      h('p', { style: { marginBottom: '14px' } }, 'Tap a name to move it to the next team.'),
      ed.el,
      h('div', { class: 'row', style: { marginTop: '22px' } },
        h('button', { class: 'btn yellow', onclick: () => { S.drum(); ed.shuffle(); } }, 'Shuffle teams'),
        h('button', { class: 'btn green', onclick: () => m.close() }, 'Done'))
    ]);
    m.box.style.width = '1480px';
  };
  // members pop-up during a game
  C.showMembers = function (t) {
    if (!t.members || !t.members.length) { ICG.toast(t.name + ' - no class chosen'); return; }
    const m = ICG.modal([
      h('div', { class: 'te-head big', style: { background: t.color } }, ICG.T.charImg(t.char, 'right', 'mini'), h('span', null, t.name)),
      h('div', { class: 'te-names big' }, t.members.map(nm => h('div', { class: 'te-name' }, nm))),
      h('div', { class: 'row', style: { marginTop: '22px' } }, h('button', { class: 'btn green', onclick: () => m.close() }, 'OK'))
    ]);
    m.box.style.minWidth = '800px'; m.box.style.maxWidth = '1300px';
  };

  /* ======================= CLASSES SCREEN ======================= */
  ICG.register('classes', {
    mount(stage) {
      stage.className = 'classes-screen';
      let sel = C.current() || C.list()[0] || null;
      let tab = 'students', nTeams = 2;
      const left = h('div', { class: 'cl-left card' });
      const right = h('div', { class: 'cl-right card' });
      const fileIn = h('input', { type: 'file', accept: '.js,.txt', style: { display: 'none' }, onchange: () => {
        const f = fileIn.files[0]; if (!f) return;
        const r = new FileReader(); r.onload = () => { const n = C.importText(String(r.result)); ICG.toast(n ? n + ' classes loaded' : 'Could not read that file'); render(); }; r.readAsText(f);
        fileIn.value = '';
      } });

      function render() {
        left.innerHTML = '';
        left.append(h('div', { class: 'cl-title' }, 'Classes'));
        C.list().forEach(c => left.append(h('button', { class: 'cl-item' + (c === sel ? ' on' : ''), onclick: () => { sel = c; render(); } },
          h('span', null, c.name), c === C.current() ? h('b', { class: 'cl-badge' }, 'in use') : null)));
        left.append(h('button', { class: 'btn white cl-new', onclick: () => ICG.ask('New class name', '', v => { sel = C.add(v); tab = 'students'; render(); editList(); }) }, '+ New class'));
        const unsaved = C.list().some(c => c.edited);
        left.append(h('div', { class: 'cl-bottom' },
          h('button', { class: 'btn ' + (unsaved ? 'yellow' : 'ghost-dark'), onclick: saveAll }, 'Save for all devices'),
          unsaved ? h('div', { class: 'small-note' }, 'Changes are only on this device') : null,
          h('button', { class: 'btn ghost-dark', onclick: () => fileIn.click() }, 'Load a classes file')));

        right.innerHTML = '';
        if (!sel) { right.append(h('div', { class: 'cl-empty' }, 'No classes yet. Tap "+ New class" to add one.')); return; }
        const inUse = sel === C.current();
        right.append(h('div', { class: 'cl-head' },
          h('div', { class: 'cl-name' }, sel.name),
          h('button', { class: 'btn ' + (inUse ? 'green' : 'white'), onclick: () => { C.setCurrent(inUse ? null : sel.name); render(); } }, inUse ? 'In use' : 'Use this class'),
          h('button', { class: 'iconbtn dark', title: 'Rename', onclick: () => ICG.ask('Class name', sel.name, v => { if (!C.rename(sel, v)) ICG.toast('That name is already used'); render(); }) }, 'Rename'),
          h('button', { class: 'iconbtn dark', title: 'Delete', onclick: () => ICG.confirm('Delete ' + sel.name + '?', 'This removes the class from this device.', 'Delete', () => { C.remove(sel); sel = C.list()[0] || null; render(); }) }, 'Delete')));
        right.append(h('div', { class: 'tabs cl-tabs' },
          h('button', { class: tab === 'students' ? 'on' : '', onclick: () => { tab = 'students'; render(); } }, 'Students (' + C.present(sel).length + ' here)'),
          h('button', { class: tab === 'teams' ? 'on' : '', onclick: () => { tab = 'teams'; render(); } }, 'Teams')));
        if (tab === 'students') {
          const absent = C.absentOf(sel);
          right.append(h('div', { class: 'small-note cl-note' }, 'Tap a name to mark it absent today (it comes back tomorrow).'),
            h('div', { class: 'cl-names' }, sel.students.length ? sel.students.map(nm => h('button', { class: 'cl-name-chip' + (absent.includes(nm) ? ' away' : ''), onclick: () => { C.toggleAbsent(sel, nm); render(); } }, nm)) : h('div', { class: 'cl-empty' }, 'No names yet')),
            h('div', { class: 'row cl-actions' }, h('button', { class: 'btn white', onclick: editList }, 'Edit names')));
        } else {
          const teams = ICG.T.makeTeams(ICG.T.loadTeams(), nTeams);
          const ed = C.teamsEditor(sel, nTeams, teams, () => render());
          right.append(h('div', { class: 'cl-teamrow' },
            h('span', { class: 'slabel', style: { width: 'auto' } }, 'Teams:'),
            ICG.T.seg([[2, '2'], [3, '3'], [4, '4'], [5, '5'], [6, '6'], [7, '7'], [8, '8']], nTeams, v => { nTeams = v; render(); }),
            h('button', { class: 'btn yellow', onclick: () => { S.drum(); ed.shuffle(); } }, 'Shuffle teams'),
            h('span', { class: 'small-note' }, 'Tap a name to move it')),
            ed.el);
        }
      }
      function editList() {
        const ta = h('textarea', { placeholder: 'One nickname on each line (or separated by commas)' });
        ta.value = sel.students.join('\n');
        const m = ICG.modal([
          h('h2', null, sel.name + ' - names'),
          h('p', { style: { marginBottom: '16px' } }, 'One nickname on each line. You can paste a list.'),
          ta, h('div', { style: { height: '22px' } }),
          h('div', { class: 'row' },
            h('button', { class: 'btn grey', onclick: () => m.close() }, 'Cancel'),
            h('button', { class: 'btn green', onclick: () => { C.setStudents(sel, splitNames(ta.value.replace(/\n/g, ','))); m.close(); render(); } }, 'Save'))
        ], { sticky: true });
        m.box.style.width = '1200px';
      }
      function saveAll() {
        const m = ICG.modal([
          h('h2', null, 'Save for all devices'),
          h('p', null, 'This downloads a file called classes.js. Upload it to the packs folder of your website on GitHub (replace the old one). Every phone and laptop will then get these classes.'),
          h('div', { class: 'row' },
            h('button', { class: 'btn grey', onclick: () => m.close() }, 'Cancel'),
            h('button', { class: 'btn green', onclick: () => { m.close(); ICG.toast(C.download() ? 'classes.js downloaded' : 'Download did not work on this device'); render(); } }, 'Download classes.js'))
        ]);
        m.box.style.width = '1100px';
      }
      stage.append(ICG.topbar('Classes & teams', { noWheel: true }), left, right, fileIn);
      render();
    }
  });
})();
