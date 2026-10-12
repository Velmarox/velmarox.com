// Clack Arena: the interface kit. Fighter panels, pip bars, odds bars, the face inspector, tips, banners and the
// power meter. Pixel GUI pieces come from ui/ (Pixel UI pack 3, cut by tools/build_arena_ui.py).
(() => {
  const A = window.ARENA;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const px = (name, k = 2, cls = '') => `<img class="px ${cls}" src="ui/${name}${k === 2 ? '@2' : ''}.png" alt="" draggable="false">`;
  A.esc = esc; A.px = px;
  const $ = (s) => document.querySelector(s);

  // ---------- odds ----------
  // Faces grouped by kind, biggest share first. A die's odds are its faces: every face is equally likely.
  function odds(die) {
    const n = die.faces.length, by = new Map();
    die.faces.forEach((f, i) => { const k = f.t; if (!by.has(k)) by.set(k, { t: k, n: 0, faces: [] }); const g = by.get(k); g.n++; g.faces.push(i); });
    return [...by.values()].map((g) => ({ ...g, share: g.n / n })).sort((a, b) => b.n - a.n);
  }
  const pct = (x) => Math.round(x * 100) + '%';
  function oddsBar(die) {
    return '<div class="odds">' + odds(die).map((g) => {
      const T = A.FACE_TYPES[g.t];
      const room = g.n * 38;   // about the width of that many chips
      return `<span style="flex:${g.n};--c:${T.color}" title="${esc(T.name)}: ${g.n} of ${die.faces.length} faces (${pct(g.share)})">${room >= 80 ? `${esc(T.name)} <b>${pct(g.share)}</b>` : room >= 34 ? `<b>${pct(g.share)}</b>` : ''}</span>`;
    }).join('') + '</div>';
  }
  // Average damage a throw deals with its faces (Strike and Pierce), for the threat line.
  function avgHit(die) {
    return die.faces.reduce((s, f) => s + (f.t === 'strike' || f.t === 'pierce' ? f.v : 0), 0) / die.faces.length;
  }

  // ---------- pips (health) ----------
  // One segment per pip: full, just lost (flashes) or empty.
  function pips(hp, max, prev = hp) {
    hp = Math.max(0, hp); prev = Math.max(hp, prev);
    let s = '';
    for (let i = 0; i < max; i++) s += `<i class="${i < hp ? 'on' : i < prev ? 'lost' : ''}"></i>`;
    return `<div class="pips${max > 30 ? ' thin' : ''}" style="--n:${max}">${s}</div>`;
  }

  // ---------- face chips ----------
  /** A clickable face. o = { die, i, chalk: [], size, owner } */
  function chip(die, i, o = {}) {
    const f = die.faces[i], same = die.faces.filter((g) => g.t === f.t && g.v === f.v && (g.icon || '') === (f.icon || '')).length;
    const tip = `${same} of ${die.faces.length} faces (${pct(same / die.faces.length)})`;
    return `<button type="button" class="chip${(o.chalk || []).includes(i) ? ' chalked' : ''}${o.cls ? ' ' + o.cls : ''}" data-face="${i}" data-inspect="1" data-name="${esc(A.faceLabel(f))}" data-text="${esc(A.faceText(f))}" data-odds="${esc(tip)}" data-color="${A.FACE_TYPES[f.t].color}"><img alt="${esc(A.faceLabel(f))}" src="${A.faceChip(f, die.look)}"></button>`;
  }
  function net(die, o = {}) {
    return `<div class="net${o.pickable ? ' pickable' : ''}">` + die.faces.map((_, i) => chip(die, i, { ...o, cls: o.only && !o.only(die.faces[i], i) ? 'off' : '' })).join('') + '</div>';
  }

  // ---------- fighter panel ----------
  /**
   * o = { side: 'p' | 'e', name, badge, tags: [html], hp, max, prev, dice: [{ die, name, chalk }], foot: html, threat: bool }
   */
  function card(o) {
    const dice = o.dice.map((d) => `
      <div class="fdie">
        <div class="fdie-head"><span class="dshape">d${d.die.sides}</span>${d.name ? `<b>${esc(d.name)}</b>` : ''}
          ${o.threat ? `<span class="threat" title="Average damage its faces deal, before Guard">hits ~${avgHit(d.die).toFixed(1)}</span>` : ''}</div>
        <div style="--faces:${d.die.faces.length}">${oddsBar(d.die)}${net(d.die, { chalk: d.chalk })}</div>
      </div>`).join('');
    return `
      <div class="fcard ${o.side}">
        <div class="fhead">${o.badge || ''}<b class="fname">${esc(o.name)}</b>${(o.tags || []).join('')}</div>
        <div class="fhp">${px('heart', 2, 'hp-ico')}${pips(o.hp, o.max, o.prev)}<span class="hpnum"><b>${Math.max(0, o.hp)}</b>/${o.max}</span></div>
        <div class="fdice">${dice}</div>
        ${o.foot || ''}
      </div>`;
  }
  const tag = (text, cls = '', title = '') => `<span class="tag ${cls}"${title ? ` title="${esc(title)}"` : ''}>${text}</span>`;

  // ---------- inspector ----------
  // Tap or click any face (or anything with data-inspect) to read it.
  let pop = null;
  function inspect(btn) {
    closePop();
    const r = btn.getBoundingClientRect(), img = btn.querySelector('img');
    pop = document.createElement('div'); pop.className = 'pop';
    pop.innerHTML = `${img ? `<img class="pop-chip" alt="" src="${img.src}">` : ''}<div><b style="color:${btn.dataset.color || '#fff'}">${esc(btn.dataset.name || '')}</b><p>${esc(btn.dataset.text || '')}</p>${btn.dataset.odds ? `<small>${esc(btn.dataset.odds)}</small>` : ''}</div>`;
    document.body.append(pop);
    const pw = pop.offsetWidth, ph = pop.offsetHeight;
    let x = r.left + r.width / 2 - pw / 2, y = r.top - ph - 10;
    if (y < 8) y = r.bottom + 10;
    pop.style.left = Math.max(8, Math.min(innerWidth - pw - 8, x)) + 'px'; pop.style.top = Math.max(8, Math.min(innerHeight - ph - 8, y)) + 'px';
  }
  function closePop() { pop?.remove(); pop = null; }

  // ---------- tips (coach marks) ----------
  let seen = new Set();
  try { seen = new Set(JSON.parse(localStorage.getItem('clackArena.seen') || '[]')); } catch { /* storage off */ }
  const saveSeen = () => { try { localStorage.setItem('clackArena.seen', JSON.stringify([...seen])); } catch { /* storage off */ } };
  let coachEl = null, handEl = null;
  /** Shows a tip once (per device). at = { x, y } in viewport pixels, where the arrow points. place: 'above' | 'below' */
  function coach(id, html, at, place = 'above', opts = {}) {
    if (!A.settings.tips || seen.has(id)) return false;
    clearCoach();
    coachEl = document.createElement('div'); coachEl.className = 'coach ' + place; coachEl.dataset.id = id;
    coachEl.innerHTML = `${px('pointer', 2, 'coach-ptr')}<div class="coach-body">${html}${opts.button === false ? '' : '<button type="button" class="pbtn small" data-act="coach-ok">Got it</button>'}</div>`;
    document.body.append(coachEl);
    const w = coachEl.offsetWidth, h = coachEl.offsetHeight;
    const x = Math.max(8, Math.min(innerWidth - w - 8, at.x - w / 2)), y = place === 'above' ? at.y - h - 18 : at.y + 18;
    coachEl.style.left = x + 'px'; coachEl.style.top = Math.max(8, Math.min(innerHeight - h - 8, y)) + 'px';
    coachEl.style.setProperty('--ax', (at.x - x) + 'px');
    return true;
  }
  function doneCoach(id) { if (id) { seen.add(id); saveSeen(); } clearCoach(); }
  function clearCoach() { coachEl?.remove(); coachEl = null; hand(null); }
  const coachId = () => coachEl?.dataset.id;
  function resetTips() { seen = new Set(); saveSeen(); }
  const wasSeen = (id) => seen.has(id);
  function markSeen(id) { seen.add(id); saveSeen(); }
  // A pointing hand that acts out a gesture: from -> to, over and over.
  function hand(from, to) {
    handEl?.remove(); handEl = null;
    if (!from) return;
    handEl = document.createElement('div'); handEl.className = 'hand';
    handEl.innerHTML = '<span class="hand-dot"></span>';
    handEl.style.setProperty('--x0', from.x + 'px'); handEl.style.setProperty('--y0', from.y + 'px');
    handEl.style.setProperty('--x1', to.x + 'px'); handEl.style.setProperty('--y1', to.y + 'px');
    document.body.append(handEl);
  }

  // ---------- banners, toasts, phase strip ----------
  function banner(title, sub = '', cls = '', ms = 1100) {
    const host = $('#banner');
    host.className = 'banner show ' + cls;
    host.innerHTML = `<b>${title}</b>${sub ? `<small>${sub}</small>` : ''}`;
    clearTimeout(banner.t); banner.t = setTimeout(() => (host.className = 'banner'), ms * (A.timeScale ?? 1));
  }
  const PHASES = [['clack', 'Clack'], ['guard', 'Guard'], ['hits', 'Hits'], ['thorn', 'Thorn']];
  function phases(active, has = {}) {
    const host = $('#phases');
    if (!active) { host.className = 'phases'; return; }
    host.className = 'phases show';
    host.innerHTML = PHASES.map(([k, n]) => `<span class="${k === active ? 'on' : ''}${has[k] ? '' : ' none'}">${n}</span>`).join('<i>›</i>');
  }

  // Power meter beside your die while you pull: the pixel signal bars, 8 frames from full to empty.
  function power(at, k) {
    const host = $('#power');
    if (!at) { host.className = 'power'; return; }
    const frame = 7 - Math.round(k * 7);
    host.className = 'power show' + (k > 0.85 ? ' max' : '');
    host.style.left = at.x + 'px'; host.style.top = at.y + 'px';
    host.querySelector('.bars').style.backgroundPosition = `-${(5 + frame * 48) * 2}px -${2 * 2}px`;
    host.querySelector('b').textContent = Math.round(k * 100) + '%';
  }
  // The "thinking" ring while an enemy tries its throws.
  function thinking(on, text = '') {
    const host = $('#thinking');
    host.className = 'thinking' + (on ? ' show' : '');
    if (on) host.querySelector('span').textContent = text;
  }

  A.ui = { odds, oddsBar, avgHit, pips, chip, net, card, tag, inspect, closePop, coach, doneCoach, clearCoach, coachId, resetTips, seen: wasSeen, markSeen, hand, banner, phases, power, thinking, get pop() { return pop; } };
})();
