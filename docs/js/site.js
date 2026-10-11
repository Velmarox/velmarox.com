(function () {
  var list = document.getElementById('project-list');
  var empty = document.getElementById('project-empty');
  var filters = document.querySelector('.filters');
  var projects = window.PROJECTS || [];
  var labels = { live: 'Live', wip: 'In progress', idea: 'Idea' };
  var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.getElementById('year').textContent = new Date().getFullYear();

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
