(function () {
  var list = document.getElementById('project-list');
  var empty = document.getElementById('project-empty');
  var filters = document.querySelector('.filters');
  var projects = window.PROJECTS || [];
  var labels = { live: 'Live', wip: 'In progress', idea: 'Idea' };
  var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.getElementById('year').textContent = new Date().getFullYear();

  // ---- confetti (click the big name) ----
  var canvas = document.getElementById('confetti');
  var ctx = canvas.getContext('2d');
  var bits = [];
  var colors = ['#ff5fa2', '#ffd23f', '#3ee8d0', '#9b7bff', '#ff8a3d', '#fff7ec'];
  var running = false;

  function resize() {
    var r = window.devicePixelRatio || 1;
    canvas.width = innerWidth * r;
    canvas.height = innerHeight * r;
    ctx.setTransform(r, 0, 0, r, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  function burst(x, y) {
    var n = calm ? 0 : 110;
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2;
      var v = 4 + Math.random() * 9;
      bits.push({
        x: x, y: y,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v - 5,
        s: 5 + Math.random() * 7, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
        c: colors[(Math.random() * colors.length) | 0], life: 0, round: Math.random() < 0.3
      });
    }
    if (!running) { running = true; requestAnimationFrame(tick); }
  }

  function tick() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    bits = bits.filter(function (b) { return b.life < 160 && b.y < innerHeight + 40; });
    bits.forEach(function (b) {
      b.life++; b.vy += 0.25; b.vx *= 0.99; b.x += b.vx; b.y += b.vy; b.r += b.vr;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - b.life / 160);
      ctx.translate(b.x, b.y); ctx.rotate(b.r); ctx.fillStyle = b.c;
      if (b.round) { ctx.beginPath(); ctx.arc(0, 0, b.s / 2, 0, Math.PI * 2); ctx.fill(); }
      else ctx.fillRect(-b.s / 2, -b.s / 4, b.s, b.s / 2);
      ctx.restore();
    });
    if (bits.length) requestAnimationFrame(tick);
    else { running = false; ctx.clearRect(0, 0, innerWidth, innerHeight); }
  }

  var logo = document.getElementById('logo');
  var hint = document.querySelector('.hint');
  if (logo) {
    logo.addEventListener('click', function (e) {
      var rect = logo.getBoundingClientRect();
      var x = e.clientX || rect.left + rect.width / 2;
      var y = e.clientY || rect.top + rect.height / 2;
      burst(x, y);
      if (hint) hint.classList.add('gone');
    });
  }

  // ---- project cards ----
  function card(p) {
    var li = document.createElement('li');
    li.className = 'card pop';
    li.dataset.tags = (p.tags || []).join(' ');
    var inner = document.createElement(p.url ? 'a' : 'div');
    inner.className = 'card-inner';
    if (p.url) {
      inner.href = p.url;
      var go = document.createElement('span');
      go.className = 'go';
      go.setAttribute('aria-hidden', 'true');
      go.textContent = '↗';
      inner.appendChild(go);
    }

    if (p.status) {
      var s = document.createElement('span');
      s.className = 'status';
      s.textContent = labels[p.status] || p.status;
      inner.appendChild(s);
    }

    var h = document.createElement('h3');
    h.textContent = p.title;
    if (p.status) h.style.marginTop = '12px';
    inner.appendChild(h);

    var b = document.createElement('p');
    b.textContent = p.blurb || '';
    inner.appendChild(b);

    if (p.tags && p.tags.length) {
      var t = document.createElement('p');
      t.className = 'tags';
      p.tags.forEach(function (tag) {
        var chip = document.createElement('span');
        chip.textContent = tag;
        t.appendChild(chip);
      });
      inner.appendChild(t);
    }
    li.appendChild(inner);
    return li;
  }

  function show(tag) {
    Array.prototype.forEach.call(list.children, function (li) {
      li.hidden = tag !== 'all' && li.dataset.tags.split(' ').indexOf(tag) === -1;
    });
    Array.prototype.forEach.call(filters.children, function (btn) {
      btn.setAttribute('aria-pressed', btn.dataset.tag === tag);
    });
  }

  if (!projects.length) {
    empty.hidden = false;
  } else {
    projects.forEach(function (p) { list.appendChild(card(p)); });
    var tags = [];
    projects.forEach(function (p) {
      (p.tags || []).forEach(function (t) { if (tags.indexOf(t) === -1) tags.push(t); });
    });
    if (tags.length > 1) {
      ['all'].concat(tags).forEach(function (t) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.dataset.tag = t;
        btn.textContent = t === 'all' ? 'All' : t;
        btn.addEventListener('click', function () { show(t); });
        filters.appendChild(btn);
      });
      show('all');
    }
  }

  // ---- pop things in as they scroll into view ----
  document.querySelectorAll('.about-card, .empty').forEach(function (el) { el.classList.add('pop'); });
  var pops = document.querySelectorAll('.pop');
  if ('IntersectionObserver' in window && !calm) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en, i) {
        if (en.isIntersecting) {
          en.target.style.transitionDelay = (i * 70) + 'ms';
          en.target.classList.add('in');
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.15 });
    pops.forEach(function (el) { io.observe(el); });
  } else {
    pops.forEach(function (el) { el.classList.add('in'); });
  }
})();
