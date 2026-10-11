(function () {
  var list = document.getElementById('project-list');
  var empty = document.getElementById('project-empty');
  var filters = document.querySelector('.filters');
  var projects = window.PROJECTS || [];
  var labels = { live: 'Live', wip: 'In progress', idea: 'Idea' };

  document.getElementById('year').textContent = new Date().getFullYear();

  function card(p) {
    var li = document.createElement('li');
    li.className = 'card';
    li.dataset.tags = (p.tags || []).join(' ');
    var inner = document.createElement(p.url ? 'a' : 'div');
    inner.className = 'card-inner';
    if (p.url) inner.href = p.url;

    var h = document.createElement('h3');
    h.textContent = p.title;
    inner.appendChild(h);

    if (p.status) {
      var s = document.createElement('span');
      s.className = 'status status-' + p.status;
      s.textContent = labels[p.status] || p.status;
      inner.appendChild(s);
    }

    var b = document.createElement('p');
    b.textContent = p.blurb || '';
    inner.appendChild(b);

    if (p.tags && p.tags.length) {
      var t = document.createElement('p');
      t.className = 'tags';
      t.textContent = p.tags.join(' · ');
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
    return;
  }

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
})();
