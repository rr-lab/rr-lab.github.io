/* Publication themes for the Publications page.
   Data comes from publication_themes.yml (inlined by publications.Rmd as JSON).
   Cards at the top filter the list of papers by year below them. */
(function () {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    var root = document.getElementById('pub-themes');
    var dataEl = document.getElementById('pub-themes-data');
    if (!root || !dataEl) return;

    var data = JSON.parse(dataEl.textContent);
    var list = function (x) { return x == null ? [] : (Array.isArray(x) ? x : [x]); };

    function esc(s) {
      return String(s).replace(/[&<>"]/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
      });
    }
    function md(s) { return esc(s).replace(/\*([^*]+)\*/g, '<em>$1</em>'); }
    function el(tag, cls, parent) {
      var e = document.createElement(tag);
      if (cls) e.className = cls;
      if (parent) parent.appendChild(e);
      return e;
    }

    /* ---- Find each paper on the page ----
       A paper starts with a paragraph whose first bold text is its number;
       anything after it (its "What we did" summary) belongs to it. */
    var years = [].slice.call(document.querySelectorAll('.section.level3')).filter(function (s) {
      return /\b(19|20)\d\d\b/.test((s.querySelector('h3') || {}).textContent || '');
    });
    var papers = {};
    var newest = [];
    years.forEach(function (section, i) {
      var current = null;
      section.yearPapers = [];
      [].slice.call(section.children).forEach(function (node) {
        if (node.tagName === 'H3') return;
        var first = node.tagName === 'P' && node.firstElementChild;
        var num = first && first.tagName === 'STRONG' && /^\d+$/.test(first.textContent.trim()) &&
          node.textContent.trim().indexOf(first.textContent.trim()) === 0 ? Number(first.textContent) : null;
        if (num !== null) {
          current = { num: num, nodes: [node], section: section };
          papers[num] = current;
          section.yearPapers.push(current);
          if (i === 0) newest.push(num);
        } else if (current) {
          current.nodes.push(node);
        }
      });
    });

    /* ---- The sets of papers, in the order the cards appear ---- */
    var sets = [];
    list(data.start_here).forEach(function (s) {
      sets.push({ id: s.id, label: s.label, description: s.description, group: 'start',
        papers: s.latest_year ? newest : list(s.papers).map(Number) });
    });
    list(data.themes).forEach(function (t) {
      sets.push({ id: t.id, label: t.label, description: t.description, color: t.color, group: 'theme',
        papers: list(t.papers).map(Number) });
    });
    sets.forEach(function (s) {
      s.found = s.papers.filter(function (n) { return papers[n]; });
      s.papers.forEach(function (n) {
        if (!papers[n] && window.console) console.warn('Publication themes: no paper ' + n + ' on the page (' + s.id + ')');
      });
    });
    var setById = {};
    sets.forEach(function (s) { setById[s.id] = s; });

    /* ---- Build the cards ---- */
    root.innerHTML = '';
    el('p', 'pt-intro', root).textContent =
      'Browse the papers by research theme, or scroll down for the full list by year.';
    var cards = {};
    function addGroup(title, group) {
      var items = sets.filter(function (s) { return s.group === group; });
      if (!items.length) return;
      el('h4', 'pt-group', root).textContent = title;
      var grid = el('div', 'pt-grid', root);
      items.forEach(function (s) {
        var b = el('button', 'pt-card', grid);
        b.type = 'button';
        b.setAttribute('aria-pressed', 'false');
        var count = el('span', 'pt-count', b);
        count.textContent = s.found.length + (s.found.length === 1 ? ' paper' : ' papers');
        var name = el('span', 'pt-name', b);
        if (s.color) {
          var dot = el('span', 'pt-dot', name);
          dot.style.background = s.color;
          dot.setAttribute('aria-hidden', 'true');
        }
        el('span', null, name).innerHTML = md(s.label);
        if (s.description) el('span', 'pt-desc', b).innerHTML = md(s.description);
        el('span', 'pt-go', b).textContent = 'Show papers →';
        b.addEventListener('click', function () {
          select(s.id, true);
          var target = document.getElementById('all-papers') || status;
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        cards[s.id] = b;
      });
    }
    addGroup('Start here', 'start');
    addGroup('Browse by theme', 'theme');

    var status = document.getElementById('pub-filter-status');
    if (!status) {
      status = el('p', null, null);
      status.id = 'pub-filter-status';
      (years[0] ? years[0].parentNode.insertBefore(status, years[0]) : root.appendChild(status));
    }
    status.className = 'pt-status';
    status.setAttribute('aria-live', 'polite');

    /* ---- Filtering ---- */
    function select(id, updateHash) {
      var s = setById[id] || null;
      Object.keys(cards).forEach(function (k) { cards[k].setAttribute('aria-pressed', s && k === s.id ? 'true' : 'false'); });
      var shown = s ? s.found : null;
      Object.keys(papers).forEach(function (n) {
        var on = !shown || shown.indexOf(Number(n)) !== -1;
        papers[n].nodes.forEach(function (node) { node.hidden = !on; });
      });
      years.forEach(function (section) {
        section.hidden = !!shown && !section.yearPapers.some(function (p) { return shown.indexOf(p.num) !== -1; });
      });

      status.innerHTML = '';
      if (s) {
        var label = el('span', null, status);
        label.innerHTML = 'Showing ' + s.found.length + (s.found.length === 1 ? ' paper' : ' papers') +
          ' in <strong>' + md(s.label) + '</strong>. ';
        var reset = el('button', 'pt-reset', status);
        reset.type = 'button';
        reset.textContent = 'Show all papers';
        reset.addEventListener('click', function () { select(null, true); });
      }
      if (updateHash && window.history && history.replaceState) {
        history.replaceState(null, '', s ? '#pubs-' + s.id : location.pathname);
      }
    }

    function fromHash() {
      var m = /^#pubs-([\w-]+)$/.exec(location.hash);
      return m ? m[1] : null;
    }
    window.addEventListener('hashchange', function () { select(fromHash(), false); });
    select(fromHash(), false);
  }
})();
