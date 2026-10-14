(function () {
  // Anything in the 'tools' category lives on /tools/ instead of with the games.
  var ALL = window.GAMES || [];
  function isTool(g) { return (g.genres || []).indexOf('tools') > -1; }
  // unlisted: true keeps a game's page up at its own link but leaves it out of every list.
  var LISTED = ALL.filter(function (g) { return !g.unlisted; });
  var GAMES = LISTED.filter(function (g) { return !isTool(g); });
  var TOOLS = LISTED.filter(isTool);
  var POSTS = (window.POSTS || []).slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  var CATS = window.CATEGORIES || {};
  // Posts tagged Devlog live on /devlog/; the blog list keeps everything else.
  function isDevlog(p) { return p.type !== 'news' && /^devlog$/i.test(p.tag || ''); }
  var WRITING = POSTS.filter(function (p) { return p.type !== 'news'; });
  var BLOG = WRITING.filter(function (p) { return !isDevlog(p); });
  var DEVLOG = WRITING.filter(isDevlog);
  var NEWS = POSTS.filter(function (p) { return p.type === 'news'; });
  var PRODUCTS = window.PRODUCTS || [];
  var SHOP_OPEN = window.SHOP_OPEN !== false;
  var GISCUS = window.GISCUS || {};
  var body = document.body;
  var page = body.dataset.page;
  var slug = body.dataset.slug;
  var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var DAY = 864e5;

  // ---------- helpers ----------
  var DISCORD_ICON = '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"/></svg>';
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function catName(k) { return CATS[k] || (k.charAt(0).toUpperCase() + k.slice(1)); }
  function date(d) {
    if (!d) return '';
    var t = new Date(d + 'T12:00:00');
    return t.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function recent(d) { return d && (Date.now() - new Date(d + 'T12:00:00')) < 30 * DAY; }
  function gameUrl(g) { return (isTool(g) ? '/tools/' : '/games/') + g.slug + '/'; }
  function postUrl(p) { return (p.type === 'news' ? '/news/' : '/blog/') + p.slug + '/'; }
  function findGame(s) { return ALL.filter(function (g) { return g.slug === s; })[0]; }
  function playable(g) { return g.status === 'live' && g.play && g.play !== '#'; }
  // Nothing to play in the browser and no download link yet: its pictures get a grey veil.
  function available(g) { return playable(g) || !!(g.download && g.download.url); }
  function veil(g) { return available(g) ? '' : '<span class="veil" aria-hidden="true"></span>'; }
  function img(src, alt, label) {
    return src
      ? '<img src="' + esc(src) + '" alt="' + esc(alt || '') + '" loading="lazy">'
      : '<div class="ph" aria-hidden="true">' + esc(label || 'Image') + '<small>placeholder</small></div>';
  }
  function badges(g) {
    var out = [];
    if (g.flag) out.push('<span class="tag warn">' + esc(g.flag) + '</span>');
    if (recent(g.released)) out.push('<span class="tag y">New</span>');
    else if (recent(g.updated)) out.push('<span class="tag solid">Updated</span>');
    if (g.status === 'wip') out.push('<span class="tag">In dev</span>');
    if (g.status === 'idea') out.push('<span class="tag dim">Idea</span>');
    return out.length ? '<div class="badge-row">' + out.join('') + '</div>' : '';
  }
  function statusTag(g) {
    if (g.status === 'live' && isTool(g)) return '<span class="tag">Free download</span>';
    if (g.status === 'live' && !g.play) return '<span class="tag">Desktop game</span>';
    if (g.status === 'live') return '<span class="tag">Free to play</span>';
    if (g.status === 'wip') return '<span class="tag">In the workshop</span>';
    return '<span class="tag dim">Idea</span>';
  }
  function genreTags(g) {
    return (g.genres || []).map(function (k) { return '<span class="tag dim">' + esc(catName(k)) + '</span>'; }).join('');
  }
  function secHead(title, more, red) {
    return '<div class="sec-head"><h2' + (red ? ' class="red"' : '') + '>' + esc(title) + '</h2>' +
      '<span class="pips"><i></i><i></i><i></i></span><span class="rule"></span>' +
      (more ? '<a class="more" href="' + more[1] + '">' + esc(more[0]) + ' &rsaquo;</a>' : '') + '</div>';
  }

  // ---------- cards ----------
  function gameCard(g) {
    return '<li><a class="card" href="' + gameUrl(g) + '"><div class="card-in">' +
      '<div class="card-img">' + img(g.thumb, g.title, 'Card') + veil(g) + badges(g) +
      (g.icon ? '<div class="card-icon">' + img(g.icon, '') + '</div>' : '') + '</div>' +
      '<div class="card-body">' + statusTag(g) +
      '<h3>' + esc(g.title) + '</h3><div class="tags">' + genreTags(g) + '</div>' +
      (g.tagline ? '<p class="line">' + esc(g.tagline) + '</p>' : '') +
      '</div></div></a></li>';
  }
  function postCard(p) {
    var g = p.game && findGame(p.game);
    return '<li><a class="card post-card" href="' + postUrl(p) + '"><div class="card-in">' +
      '<div class="card-img">' + img(p.cover || (g && (g.thumb || g.banner)), p.title, 'Cover') +
      '<div class="badge-row"><span class="tag solid">' + esc(p.tag || 'Post') + '</span>' +
      (g ? '<span class="tag">' + esc(g.title) + '</span>' : '') + '</div></div>' +
      '<div class="card-body"><span class="date">' + date(p.date) + '</span>' +
      '<h3>' + esc(p.title) + '</h3>' +
      (p.excerpt ? '<p class="ex">' + esc(p.excerpt) + '</p>' : '') +
      '</div></div></a></li>';
  }
  function postRow(p, i) {
    var g = p.game && findGame(p.game);
    var ico = g && g.icon ? img(g.icon, '') : String(i + 1).padStart(2, '0');
    return '<a class="row" href="' + postUrl(p) + '"><span class="row-ico">' + ico + '</span>' +
      '<span><b>' + esc(p.title) + '</b><small>' + esc(p.tag || 'Post') + ' · ' + date(p.date) + '</small></span>' +
      (recent(p.date) ? '<span class="live' + (i % 2 ? ' y' : '') + '">New</span>' : '<span></span>') + '</a>';
  }
  function workshopRow(g, i) {
    return '<a class="row" href="' + gameUrl(g) + '"><span class="row-ico">' + (g.icon ? img(g.icon, '') : esc(g.title.charAt(0))) + '</span>' +
      '<span><b>' + esc(g.title) + '</b><small>' + esc((g.genres || []).map(catName).join(' · ')) + '</small>' +
      (g.progress != null ? '<div class="meter" title="' + g.progress + '%"><i style="width:' + Math.max(0, Math.min(100, g.progress)) + '%"></i></div>' : '') +
      '</span><span class="live' + (i % 2 ? ' y' : '') + '">' + (g.progress != null ? g.progress + '%' : 'WIP') + '</span></a>';
  }

  function productCard(p) {
    var g = p.game && findGame(p.game);
    var st = p.status || 'available';
    var buy = st === 'sold-out' ? '<span class="btn ghost" aria-disabled="true">Sold out</span>'
      : (st === 'soon' || !p.link) ? '<span class="btn ghost" aria-disabled="true">Coming soon</span>'
      : '<a class="btn" href="' + esc(p.link) + '" rel="noopener">Buy</a>';
    return '<li class="card product' + (st === 'sold-out' ? ' out' : '') + '"><div class="card-in">' +
      '<div class="card-img">' + img(p.image, p.title, 'Product') +
      '<div class="badge-row">' + (p.badge ? '<span class="tag y">' + esc(p.badge) + '</span>' : '') +
        (st === 'sold-out' ? '<span class="tag solid">Sold out</span>' : '') + '</div></div>' +
      '<div class="card-body"><span class="tag">' + esc(p.kind || 'Item') + '</span>' +
      '<h3>' + esc(p.title) + '</h3>' +
      (p.blurb ? '<p class="ex">' + esc(p.blurb) + '</p>' : '') +
      (g ? '<p class="line"><a href="' + gameUrl(g) + '">From ' + esc(g.title) + '</a></p>' : '') +
      '<div class="buy"><span class="price">' + esc(p.price || '') + '</span>' + buy + '</div>' +
      '</div></div></li>';
  }

  // ---------- header / footer ----------
  function categoryCounts() {
    var counts = {};
    GAMES.forEach(function (g) { (g.genres || []).forEach(function (k) { counts[k] = (counts[k] || 0) + 1; }); });
    return Object.keys(counts).sort(function (a, b) { return catName(a).localeCompare(catName(b)); })
      .map(function (k) { return [k, counts[k]]; });
  }
  function playNowTarget() {
    var f = GAMES.filter(function (g) { return g.featured && g.status === 'live'; })[0] ||
            GAMES.filter(function (g) { return g.status === 'live'; })[0];
    return f ? gameUrl(f) : '/games/';
  }
  function chrome() {
    var cur = { game: 'games', devlog: 'blog' }[page] || page;
    if (page === 'game' && findGame(slug) && isTool(findGame(slug))) cur = 'tools';
    if (page === 'post') {
      var me = POSTS.filter(function (p) { return p.slug === slug; })[0];
      cur = me && me.type === 'news' ? 'news' : 'blog';
    }
    function a(key, href, label) { return '<a href="' + href + '"' + (cur === key ? ' aria-current="page"' : '') + '>' + label + '</a>'; }
    var cats = categoryCounts().map(function (c) {
      return '<a href="/games/?cat=' + c[0] + '">' + esc(catName(c[0])) + ' <small>' + c[1] + '</small></a>';
    }).join('');
    var head = document.createElement('header');
    head.className = 'site-head';
    head.innerHTML =
      '<div class="wrap head-in">' +
        '<a class="logo" href="/" aria-label="VRX Games home"><picture><source srcset="/assets/brand/vrx-games.webp" type="image/webp"><img src="/assets/brand/vrx-games.png" width="520" height="245" alt="VRX Games"></picture></a>' +
        '<button class="menu-btn" type="button" aria-label="Menu" aria-expanded="false"><span></span><span></span><span></span></button>' +
        '<nav class="nav" aria-label="Main">' +
          a('home', '/', 'Home') +
          '<div class="drop"><button type="button" aria-expanded="false"' + (cur === 'games' ? ' aria-current="page"' : '') + '>Games <i class="caret"></i></button>' +
            '<div class="drop-menu"><a href="/games/">All games <small>' + GAMES.length + '</small></a><div class="sep"></div>' + cats + '</div></div>' +
          (TOOLS.length ? a('tools', '/tools/', 'Tools') : '') +
          a('blog', '/blog/', 'Blog') +
          a('news', '/news/', 'News') +
          a('shop', '/shop/', 'Shop') +
          '<a class="btn yellow mobile-cta" href="' + playNowTarget() + '">Play now</a>' +
        '</nav>' +
        '<div class="head-cta"><a class="btn yellow" href="' + playNowTarget() + '">Play now</a></div>' +
      '</div>';
    body.insertBefore(head, body.firstChild);

    if ([GAMES, POSTS, PRODUCTS].some(function (l) { return l.some(function (x) { return x.sample; }); })) {
      var bar = document.createElement('div');
      bar.className = 'sample-bar';
      bar.textContent = 'Preview: everything marked sample is a placeholder';
      body.insertBefore(bar, head.nextSibling);
    }

    var menuBtn = $('.menu-btn', head);
    menuBtn.addEventListener('click', function () {
      var open = head.classList.toggle('open');
      menuBtn.setAttribute('aria-expanded', open);
    });
    var drop = $('.drop', head);
    var dropBtn = $('button', drop);
    dropBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = drop.classList.toggle('open');
      dropBtn.setAttribute('aria-expanded', open);
    });
    document.addEventListener('click', function (e) {
      if (!drop.contains(e.target)) { drop.classList.remove('open'); dropBtn.setAttribute('aria-expanded', 'false'); }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { drop.classList.remove('open'); dropBtn.setAttribute('aria-expanded', 'false'); }
    });

    var foot = document.createElement('footer');
    foot.className = 'site-foot';
    foot.innerHTML =
      '<div class="hazard"></div>' +
      '<div class="wrap foot-in">' +
        '<div>' + '<a class="logo" href="/" aria-label="VRX Games home"><picture><source srcset="/assets/brand/vrx-games.webp" type="image/webp"><img src="/assets/brand/vrx-games.png" width="520" height="245" alt="VRX Games"></picture></a>' +
        '<p>Games, experiments and devlogs. Made by one person, for fun.</p></div>' +
        '<div><h4>Games</h4><ul><li><a href="/games/">All games</a></li>' +
          categoryCounts().slice(0, 5).map(function (c) { return '<li><a href="/games/?cat=' + c[0] + '">' + esc(catName(c[0])) + '</a></li>'; }).join('') +
        '</ul></div>' +
        '<div><h4>Site</h4><ul><li><a href="/">Home</a></li>' + (TOOLS.length ? '<li><a href="/tools/">Tools</a></li>' : '') + '<li><a href="/blog/">Blog</a></li><li><a href="/news/">News</a></li>' +
          '<li><a href="/shop/">Shop</a></li>' +
          (window.DISCORD ? '<li><a class="foot-discord" href="' + esc(window.DISCORD) + '" target="_blank" rel="noopener">' + DISCORD_ICON + 'Discord</a></li>' : '') + '</ul></div>' +
      '</div>' +
      '<div class="wrap foot-base"><span>&copy; ' + new Date().getFullYear() + ' Velmarox</span><span>velmarox.com</span></div>';
    body.appendChild(foot);
  }

  // ---------- home ----------
  function home() {
    var main = $('main');
    var feat = GAMES.filter(function (g) { return g.featured; });
    if (!feat.length) feat = GAMES.slice(0, 3);
    var trending = GAMES.filter(function (g) { return g.trending; }).slice(0, 6);
    var fresh = GAMES.filter(function (g) { return g.released; })
      .sort(function (a, b) { return a.released < b.released ? 1 : -1; }).slice(0, 6);
    var wip = GAMES.filter(function (g) { return g.status === 'wip'; });

    var html = '';
    if (feat.length) {
      html += '<section class="hero"><div class="wrap hero-grid">' +
        '<div class="hero-text" id="hero-text"></div>' +
        '<div class="screen-wrap"><span class="num" id="hero-num"></span><span class="hazard hz-top"></span>' +
          '<a class="screen" id="hero-screen" href="#"><div class="screen-in"><span class="hatch-tl"></span><span class="hatch-br"></span><div id="hero-img"></div></div></a>' +
          '<span class="hazard hz-bot"></span><span class="cross c1"></span><span class="cross c2"></span></div>' +
        '<div class="dots" role="tablist" aria-label="Featured games">' +
          feat.map(function (g, i) { return '<button type="button" role="tab" aria-label="' + esc(g.title) + '" data-i="' + i + '"></button>'; }).join('') +
        '</div></div>' +
        '<div class="bars wrap" aria-hidden="true"><span class="on"></span><span class="on"></span><span></span></div></section>';
    }
    html += '<div class="wrap home-grid"><div>';
    html += '<section class="sec">' + secHead('Trending now', ['All games', '/games/']) +
      (trending.length ? '<ul class="cards">' + trending.map(gameCard).join('') + '</ul>' : '<p class="empty-note">Nothing here yet.</p>') + '</section>';
    html += '<section class="sec">' + secHead('New releases', null, true) +
      (fresh.length ? '<ul class="cards">' + fresh.map(gameCard).join('') + '</ul>' : '<p class="empty-note">Nothing released yet.</p>') + '</section>';
    html += '</div><aside class="sec">' +
      secHead('Latest news', ['News', '/news/']) +
      '<div class="panel"><div class="panel-in">' + (NEWS.length ? NEWS.slice(0, 4).map(postRow).join('') : '<p class="empty-note">No news yet.</p>') + '</div></div>' +
      (window.DISCORD ? secHead('Discord', null, true) + '<div class="panel"><div class="panel-in">' +
        '<a class="row" href="' + esc(window.DISCORD) + '" target="_blank" rel="noopener"><span class="row-ico">' + DISCORD_ICON + '</span>' +
        '<span><b>Join the Discord</b><small>Chat, bug reports, ideas</small></span><span class="live y">Join</span></a></div></div>' : '') +
      (wip.length ? secHead('In the workshop', null, true) + '<div class="panel"><div class="panel-in">' + wip.map(workshopRow).join('') + '</div></div>' : '') +
      '</aside></div>';
    if (WRITING.length) {
      html += '<section class="sec wrap">' + secHead('From the blog', ['All posts', '/blog/']) +
        '<ul class="posts">' + WRITING.slice(0, 3).map(postCard).join('') + '</ul></section>';
    }
    var shopPick = !SHOP_OPEN ? [] : PRODUCTS.filter(function (p) { return (p.status || 'available') !== 'sold-out'; }).slice(0, 4);
    if (shopPick.length) {
      html += '<section class="sec wrap">' + secHead('From the shop', ['Shop', '/shop/'], true) +
        '<ul class="cards shop-grid">' + shopPick.map(productCard).join('') + '</ul></section>';
    }
    main.innerHTML = html;

    if (!feat.length) return;
    var i = 0, timer;
    var dots = main.querySelectorAll('.dots button');
    function show(n) {
      i = (n + feat.length) % feat.length;
      var g = feat[i];
      var words = g.title.toUpperCase().split(' ');
      var l1 = words.length > 1 ? words.slice(0, Math.ceil(words.length / 2)).join(' ') : words[0];
      var l2 = words.length > 1 ? words.slice(Math.ceil(words.length / 2)).join(' ') : '';
      $('#hero-text').innerHTML =
        '<div class="hero-fade"><div class="slide-no"><b>' + String(i + 1).padStart(2, '0') + '</b> / ' + String(feat.length).padStart(2, '0') + ' &nbsp;FEATURED</div>' +
        '<h1 class="hero-title"><span class="l1">' + esc(l1) + '</span>' + (l2 ? '<span class="l2">' + esc(l2) + '</span>' : '') + '</h1>' +
        '<p class="hero-sub">' + esc(g.tagline || '') + '</p>' +
        '<div class="hero-meta">' + (g.flag ? '<span class="tag warn">' + esc(g.flag) + '</span>' : '') + statusTag(g) + genreTags(g) + '</div>' +
        '<div class="hero-actions">' +
          (playable(g) ? '<a class="btn big" href="' + esc(g.play) + '">Play now</a>' : '<a class="btn big" href="' + gameUrl(g) + '">' + (g.download ? 'Get it' : g.status === 'live' ? 'Play now' : 'See game') + '</a>') +
          '<a class="btn ghost big" href="' + gameUrl(g) + '">Details</a></div></div>';
      $('#hero-img').innerHTML = img(g.banner || g.thumb, g.title, 'Image') + veil(g);
      $('#hero-screen').href = gameUrl(g);
      $('#hero-num').textContent = String(i + 1).padStart(2, '0');
      dots.forEach(function (d, k) { d.setAttribute('aria-current', k === i); });
    }
    function auto() { if (!calm && feat.length > 1) { clearInterval(timer); timer = setInterval(function () { show(i + 1); }, 6500); } }
    dots.forEach(function (d) { d.addEventListener('click', function () { show(+d.dataset.i); auto(); }); });
    var hero = $('.hero');
    hero.addEventListener('mouseenter', function () { clearInterval(timer); });
    hero.addEventListener('mouseleave', auto);
    show(0); auto();
  }

  // ---------- games list ----------
  function games() {
    var main = $('main');
    var cat = new URLSearchParams(location.search).get('cat');
    if (cat === 'tools') { location.replace('/tools/'); return; }
    if (cat && !GAMES.some(function (g) { return (g.genres || []).indexOf(cat) > -1; })) cat = null;
    var list = GAMES.filter(function (g) { return !cat || (g.genres || []).indexOf(cat) > -1; });
    var order = { live: 0, wip: 1, idea: 2 };
    list.sort(function (a, b) { return (order[a.status] || 0) - (order[b.status] || 0) || ((b.updated || b.released || '') > (a.updated || a.released || '') ? 1 : -1); });
    document.title = (cat ? catName(cat) + ' games' : 'All games') + ' | VRX Games';
    main.innerHTML =
      '<div class="wrap"><div class="page-head"><div class="crumbs"><a href="/">Home</a><span>/</span>Games</div>' +
      '<h1>' + (cat ? esc(catName(cat)) + ' <em>games</em>' : 'All <em>games</em>') + '</h1>' +
      '<p>' + list.length + ' game' + (list.length === 1 ? '' : 's') + (cat ? ' in this category.' : ', from finished to half-built.') + '</p></div>' +
      '<nav class="chips" aria-label="Categories"><a class="chip" href="/games/"' + (!cat ? ' aria-current="true"' : '') + '>All <small>' + GAMES.length + '</small></a>' +
        categoryCounts().map(function (c) {
          return '<a class="chip" href="/games/?cat=' + c[0] + '"' + (cat === c[0] ? ' aria-current="true"' : '') + '>' + esc(catName(c[0])) + ' <small>' + c[1] + '</small></a>';
        }).join('') + '</nav>' +
      '<section class="sec">' + (list.length ? '<ul class="cards">' + list.map(gameCard).join('') + '</ul>' : '<p class="empty-note">No games here yet.</p>') + '</section></div>';
  }

  // ---------- tools ----------
  // Tools are downloads first; a browser build, if there is one, is the preview.
  function toolButtons(g, stacked) {
    var d = g.download || {};
    var big = stacked ? ' big' : '';
    var gap = stacked ? ' style="margin-top:10px"' : '';
    return (d.url
        ? '<a class="btn' + big + '" href="' + esc(d.url) + '" rel="noopener">' + esc(d.label || 'Download') + '</a>'
        : '<a class="btn' + big + '" aria-disabled="true">' + esc(d.label || 'Download') + '</a>') +
      (playable(g) ? '<a class="btn ghost"' + gap + ' href="' + esc(g.play) + '">Try it in the browser</a>' : '') +
      (stacked
        ? '<small>' + esc(d.note || (d.url ? 'Free download' : 'No public download yet')) + '</small>'
        : '<a class="btn ghost" href="' + gameUrl(g) + '">Details</a>');
  }
  function toolBanner(g) {
    var first = (g.about || '').split(/\n\s*\n/)[0];
    return '<li class="tool"><div class="tool-in">' +
      '<a class="tool-img" href="' + gameUrl(g) + '" tabindex="-1" aria-hidden="true">' + img(g.banner || g.thumb, '', 'Banner') + veil(g) + badges(g) + '</a>' +
      '<div class="tool-body">' +
        '<div class="game-id">' + (g.icon ? '<div class="game-icon"><div>' + img(g.icon, '') + '</div></div>' : '') +
          '<div><div class="tags">' + statusTag(g) + (g.version ? '<span class="tag dim">v' + esc(g.version) + '</span>' : '') + '</div>' +
          '<h2><a href="' + gameUrl(g) + '">' + esc(g.title) + '</a></h2>' +
          (g.tagline ? '<p class="line">' + esc(g.tagline) + '</p>' : '') + '</div></div>' +
        (first ? '<p class="ex">' + esc(first) + '</p>' : '') +
        '<div class="tool-actions">' + toolButtons(g, false) + '</div>' +
        '<p class="note">' + esc([g.platforms, g.download && g.download.note].filter(Boolean).join(' · ')) + '</p>' +
      '</div></div></li>';
  }
  function tools() {
    var list = TOOLS.slice().sort(function (a, b) { return (b.updated || b.released || '') > (a.updated || a.released || '') ? 1 : -1; });
    $('main').innerHTML =
      '<div class="wrap"><div class="page-head"><div class="crumbs"><a href="/">Home</a><span>/</span>Tools</div>' +
      '<h1>The <em>tools</em></h1><p>Small apps I made because I wanted them. Free to download.</p></div>' +
      '<section class="sec">' + (list.length ? '<ul class="tools">' + list.map(toolBanner).join('') + '</ul>' : '<p class="empty-note">No tools yet.</p>') + '</section></div>';
  }

  // ---------- single game ----------
  function game() {
    var main = $('main');
    var g = findGame(slug);
    if (!g) {
      main.innerHTML = '<div class="wrap page-head"><h1>Game <em>not found</em></h1><p>This folder has no entry in games.js yet. <a href="/games/">All games</a></p></div>';
      return;
    }
    document.title = g.title + ' | VRX Games';
    var shots = (g.shots && g.shots.length) ? g.shots : [g.banner || g.thumb || null];
    var tool = isTool(g);
    var pool = tool ? TOOLS : GAMES;
    var related = POSTS.filter(function (p) { return p.game === g.slug; });
    var more = pool.filter(function (x) {
      return x.slug !== g.slug && (x.genres || []).some(function (k) { return (g.genres || []).indexOf(k) > -1; });
    });
    if (more.length < 3) more = more.concat(pool.filter(function (x) { return x.slug !== g.slug && more.indexOf(x) < 0; }));
    more = more.slice(0, 4);

    var rows = [
      ['Status', g.status === 'live' ? (tool ? 'Released' : g.play ? 'Playable' : 'Released (desktop)') : g.status === 'wip' ? 'In development' + (g.progress != null ? ' (' + g.progress + '%)' : '') : 'Idea'],
      ['Genre', (g.genres || []).map(catName).join(', ')],
      ['Controls', g.controls], ['Platforms', g.platforms], ['Session', g.session],
      ['Version', g.version], ['Released', date(g.released)], ['Updated', date(g.updated)]
    ].filter(function (r) { return r[1]; });

    var aboutHtml = (g.about || '').split(/\n\s*\n/).filter(Boolean).map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('');

    main.innerHTML =
      '<div class="wrap">' +
      '<div class="page-head" style="padding-bottom:0"><div class="crumbs"><a href="/">Home</a><span>/</span>' + (tool ? '<a href="/tools/">Tools</a>' : '<a href="/games/">Games</a>') + '<span>/</span>' + esc(g.title) + '</div></div>' +
      (g.warning ? '<aside class="warning" role="note"><div class="warning-in"><div class="warning-mark" aria-hidden="true">!</div><div>' +
        '<h2>' + esc(g.warning.title || 'Warning') + '</h2><p>' + esc(g.warning.text || '') + '</p></div></div></aside>' : '') +
      '<div class="game-top"><div>' +
        '<div class="game-id">' + (g.icon ? '<div class="game-icon"><div>' + img(g.icon, '') + '</div></div>' : '') +
          '<div><h1>' + esc(g.title) + '</h1>' + (g.tagline ? '<p>' + esc(g.tagline) + '</p>' : '') +
          '<div class="tags">' + statusTag(g) + genreTags(g) + '</div></div></div>' +
        '<div class="screen-wrap"><div class="screen"><div class="screen-in"><span class="hatch-tl"></span><span class="hatch-br"></span><div id="shot">' + img(shots[0], g.title + ' screenshot', 'Screenshot') + '</div></div></div></div>' +
        (shots.length > 1 ? '<div class="gallery-thumbs">' + shots.map(function (s, k) {
          return '<button type="button" data-k="' + k + '" aria-label="Screenshot ' + (k + 1) + '"' + (k ? '' : ' aria-current="true"') + '>' + img(s, '') + '</button>';
        }).join('') + '</div>' : '') +
      '</div><aside>' +
        '<div class="panel details"><div class="panel-in">' +
          '<div class="play-box">' + (tool ? toolButtons(g, true) : g.download && !playable(g)
            ? (g.download.url
              ? '<a class="btn big" href="' + esc(g.download.url) + '" rel="noopener">' + esc(g.download.label || 'Download') + '</a>'
              : '<a class="btn big" aria-disabled="true">' + esc(g.download.label || 'Download') + '</a>') +
              (g.download.note ? '<small>' + esc(g.download.note) + '</small>' : '')
            : playable(g)
            ? '<a class="btn big" href="' + esc(g.play) + '">Play now</a>' +
              (g.download && g.download.url ? '<a class="btn ghost" style="margin-top:10px" href="' + esc(g.download.url) + '" rel="noopener">' + esc(g.download.label || 'Download') + '</a>' : '') +
              (g.links || []).map(function (l) { return '<a class="btn ghost" style="margin-top:10px" href="' + esc(l.url) + '">' + esc(l.label) + '</a>'; }).join('') +
              '<small>' + (g.download && g.download.note ? esc(g.download.note) : 'Free · runs in your browser') + '</small>'
            : '<a class="btn big" aria-disabled="true">' + (g.status === 'live' ? 'Play now' : 'Coming soon') + '</a><small>' + (g.status === 'live' ? 'Link not set yet' : 'Not playable yet') + '</small>') +
          '</div><dl>' + rows.map(function (r) { return '<div class="d"><dt>' + r[0] + '</dt><dd>' + esc(r[1]) + '</dd></div>'; }).join('') + '</dl>' +
        '</div></div>' +
      '</aside></div>' +
      '<div class="two sec">' +
        '<section>' + secHead('About') + '<div class="prose">' + (aboutHtml || '<p>No description yet.</p>') + '</div>' +
          (g.howto && g.howto.length ? '<div style="margin-top:28px">' + secHead(tool ? 'How to use' : 'How to play', null, true) + '<ol class="steps">' + g.howto.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol></div>' : '') +
        '</section>' +
        '<section>' + secHead('Devlog') +
          (g.log && g.log.length ? '<ul class="log">' + g.log.map(function (l) { return '<li><time>' + date(l.date) + '</time><span>' + esc(l.text) + '</span></li>'; }).join('') + '</ul>' : '<p class="empty-note">No updates yet.</p>') +
          (related.length ? '<div style="margin-top:28px">' + secHead('Posts', null, true) + '<div class="panel"><div class="panel-in">' + related.map(postRow).join('') + '</div></div></div>' : '') +
        '</section>' +
      '</div>' +
      (more.length ? '<section class="sec">' + secHead(tool ? 'More tools' : 'More games', tool ? ['All tools', '/tools/'] : ['All games', '/games/']) + '<ul class="cards">' + more.map(gameCard).join('') + '</ul></section>' : '') +
      '</div>';

    main.querySelectorAll('.gallery-thumbs button').forEach(function (b) {
      b.addEventListener('click', function () {
        $('#shot').innerHTML = img(shots[+b.dataset.k], g.title + ' screenshot', 'Screenshot');
        main.querySelectorAll('.gallery-thumbs button').forEach(function (x) { x.setAttribute('aria-current', x === b); });
      });
    });
  }

  // ---------- blog list ----------
  function postList(list, crumb, h1, intro, extra) {
    $('main').innerHTML =
      '<div class="wrap"><div class="page-head"><div class="crumbs"><a href="/">Home</a><span>/</span>' + crumb + '</div>' +
      '<h1>' + h1 + '</h1><p>' + intro + '</p></div>' + (extra || '') +
      '<section class="sec">' + (list.length ? '<ul class="posts">' + list.map(postCard).join('') + '</ul>' : '<p class="empty-note">Nothing posted yet.</p>') + '</section></div>';
  }
  // Every game and tool's devlog entries in one list, newest first.
  function updates() {
    var out = [];
    LISTED.forEach(function (g) { (g.log || []).forEach(function (l) { out.push({ g: g, date: l.date, text: l.text }); }); });
    return out.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
  }
  function blog() {
    var latest = [DEVLOG[0] && DEVLOG[0].date, updates()[0] && updates()[0].date].filter(Boolean).sort().pop();
    postList(BLOG, 'Blog', 'The <em>blog</em>', 'Thoughts and whatever else is on my mind.',
      '<div class="panel dev-link"><div class="panel-in"><a class="dev-banner" href="/devlog/"><span class="tag y">Devlog</span>' +
        '<b>The devlog</b><small>Build notes and every update to every game and tool' + (latest ? ' · last entry ' + date(latest) : '') + '</small>' +
        '<span class="btn yellow">Open the devlog</span></a></div></div>');
  }
  function devlog() {
    var log = updates();
    $('main').innerHTML =
      '<div class="wrap"><div class="page-head"><div class="crumbs"><a href="/">Home</a><span>/</span><a href="/blog/">Blog</a><span>/</span>Devlog</div>' +
      '<h1>The <em>devlog</em></h1><p>Build notes, and every update to every game and tool.</p></div>' +
      '<section class="sec">' + secHead('Devlog posts') +
        (DEVLOG.length ? '<ul class="posts">' + DEVLOG.map(postCard).join('') + '</ul>' : '<p class="empty-note">No devlog posts yet.</p>') + '</section>' +
      '<section class="sec">' + secHead('Every update', null, true) +
        (log.length ? '<div class="panel"><div class="panel-in"><ul class="log all-log">' + log.map(function (l) {
          return '<li><time>' + date(l.date) + '</time><span><a class="log-game" href="' + gameUrl(l.g) + '">' + esc(l.g.title) + '</a>' + esc(l.text) + '</span></li>';
        }).join('') + '</ul></div></div>' : '<p class="empty-note">No updates yet.</p>') + '</section></div>';
  }
  function news() { postList(NEWS, 'News', 'Latest <em>news</em>', 'Releases, updates and announcements.'); }

  // ---------- comments (giscus: one GitHub Discussion per post, titled post:<slug>) ----------
  function giscusReady() { return GISCUS.repo && GISCUS.repoId && GISCUS.categoryId; }
  function comments(box, term) {
    if (!giscusReady()) {
      box.innerHTML = '<div class="panel"><div class="panel-in"><p class="empty-note">Comments open soon.</p></div></div>';
      return;
    }
    var sc = document.createElement('script');
    sc.src = 'https://giscus.app/client.js';
    sc.async = true;
    sc.crossOrigin = 'anonymous';
    var attrs = {
      'data-repo': GISCUS.repo, 'data-repo-id': GISCUS.repoId,
      'data-category': GISCUS.category, 'data-category-id': GISCUS.categoryId,
      'data-mapping': 'specific', 'data-term': term, 'data-strict': '1',
      'data-reactions-enabled': '1', 'data-emit-metadata': '0', 'data-input-position': 'top',
      'data-theme': 'transparent_dark', 'data-lang': 'en', 'data-loading': 'lazy'
    };
    Object.keys(attrs).forEach(function (k) { sc.setAttribute(k, attrs[k]); });
    box.appendChild(sc);
  }

  // ---------- shop ----------
  function shop() {
    if (!SHOP_OPEN) {
      $('main').innerHTML =
        '<div class="wrap"><div class="page-head"><div class="crumbs"><a href="/">Home</a><span>/</span>Shop</div></div>' +
        '<section class="soon" aria-label="Shop coming soon"><div class="soon-in">' +
          '<span class="hazard"></span>' +
          '<p class="soon-kicker">The shop</p>' +
          '<h1>Coming <em>soon</em></h1>' +
          '<p class="soon-text">Soundtracks, extras and merch are on the way. Check the news for when it opens.</p>' +
          '<div class="soon-actions"><a class="btn big" href="/news/">Latest news</a><a class="btn ghost big" href="/games/">Play the games</a></div>' +
          '<span class="hazard red"></span>' +
        '</div><span class="cross c1"></span><span class="cross c2"></span></section></div>';
      return;
    }
    var kind = new URLSearchParams(location.search).get('kind');
    var kinds = [];
    PRODUCTS.forEach(function (p) { if (p.kind && kinds.indexOf(p.kind) < 0) kinds.push(p.kind); });
    if (kind && kinds.indexOf(kind) < 0) kind = null;
    var order = { available: 0, soon: 1, 'sold-out': 2 };
    var list = PRODUCTS.filter(function (p) { return !kind || p.kind === kind; })
      .sort(function (a, b) { return (order[a.status || 'available'] || 0) - (order[b.status || 'available'] || 0); });
    $('main').innerHTML =
      '<div class="wrap"><div class="page-head"><div class="crumbs"><a href="/">Home</a><span>/</span>Shop</div>' +
      '<h1>The <em>shop</em></h1><p>Soundtracks, extras and merch. Every purchase helps keep the games free.</p></div>' +
      '<nav class="chips" aria-label="Product types"><a class="chip" href="/shop/"' + (!kind ? ' aria-current="true"' : '') + '>All <small>' + PRODUCTS.length + '</small></a>' +
        kinds.map(function (k) {
          var n = PRODUCTS.filter(function (p) { return p.kind === k; }).length;
          return '<a class="chip" href="/shop/?kind=' + encodeURIComponent(k) + '"' + (kind === k ? ' aria-current="true"' : '') + '>' + esc(k) + ' <small>' + n + '</small></a>';
        }).join('') + '</nav>' +
      '<section class="sec">' + (list.length ? '<ul class="cards shop-grid">' + list.map(productCard).join('') + '</ul>' : '<p class="empty-note">Nothing in the shop yet.</p>') + '</section>' +
      '<div class="hazard red" style="opacity:.5"></div>' +
      '<p class="shop-note">Purchases are handled by the store each item links to. Questions about an order go to that store.</p></div>';
  }

  // ---------- single post (content lives in the page's <article>) ----------
  function post() {
    var main = $('main');
    var article = $('#post-content');
    var p = POSTS.filter(function (x) { return x.slug === slug; })[0] || {};
    var g = p.game && findGame(p.game);
    if (p.title) document.title = p.title + ' | VRX Games';
    var idx = POSTS.indexOf(p);
    var isNews = p.type === 'news';
    var isDev = isDevlog(p);
    var others = (isNews ? NEWS : isDev ? DEVLOG : BLOG).filter(function (x) { return x !== p; }).slice(0, 3);
    var wrap = document.createElement('div');
    wrap.className = 'wrap';
    wrap.innerHTML =
      '<header class="post-head"><div class="crumbs"><a href="/">Home</a><span>/</span>' + (isNews ? '<a href="/news/">News</a>' : '<a href="/blog/">Blog</a>' + (isDev ? '<span>/</span><a href="/devlog/">Devlog</a>' : '')) + '</div>' +
        '<div class="tags"><span class="tag solid">' + esc(p.tag || 'Post') + '</span>' + (g ? '<a class="tag" href="' + gameUrl(g) + '">' + esc(g.title) + '</a>' : '') + '</div>' +
        '<h1>' + esc(p.title || document.title) + '</h1>' +
        '<div class="post-meta"><span>' + date(p.date) + '</span></div></header>' +
      (p.cover ? '<div class="post-cover screen"><div class="screen-in">' + img(p.cover, '') + '</div></div>' : '') +
      '<div class="post-body"></div>' +
      '<section class="sec comments">' + secHead('Comments') + '<div id="comments"></div></section>' +
      (others.length ? '<section class="sec">' + secHead(isNews ? 'More news' : isDev ? 'More devlog' : 'More posts', isNews ? ['All news', '/news/'] : isDev ? ['Devlog', '/devlog/'] : ['All posts', '/blog/']) + '<ul class="posts">' + others.map(postCard).join('') + '</ul></section>' : '');
    article.classList.add('prose');
    $('.post-body', wrap).appendChild(article);
    main.appendChild(wrap);
    comments($('#comments'), 'post:' + slug);
    void idx;
  }

  function notFound() {
    $('main').innerHTML = '<div class="wrap page-head"><div class="crumbs"><a href="/">Home</a></div><h1>Lost <em>signal</em></h1>' +
      '<p>Nothing lives at this address.</p><p style="margin-top:22px"><a class="btn" href="/">Back home</a> &nbsp; <a class="btn ghost" href="/games/">All games</a></p></div>';
  }

  chrome();
  ({ home: home, games: games, tools: tools, game: game, blog: blog, devlog: devlog, news: news, post: post,
     shop: shop, '404': notFound }[page] || function () {})();
})();
