/* Research map for the Research page.
   Data comes from research_map.yml (inlined by research.Rmd as JSON). */
(function () {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
  var root = document.getElementById('research-map');
  var dataEl = document.getElementById('research-map-data');
  if (!root || !dataEl) return;

  var data = JSON.parse(dataEl.textContent);
  var list = function (x) { return x == null ? [] : (Array.isArray(x) ? x : [x]); };
  var themes = list(data.themes);
  var loci = list(data.loci);
  var lens = list(data.chromosomes_mb).map(Number);
  var maxLen = Math.max.apply(null, lens);
  var GREY = '#c9c2a8';
  var BAR = '#e4dec8';

  var themeById = {};
  themes.forEach(function (t) { t.sections = list(t.sections); themeById[t.id] = t; });
  loci.forEach(function (l) { l.themes = list(l.themes); });

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
  function rgba(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  function locusName(l) { return l.italic ? '<em>' + esc(l.label) + '</em>' : esc(l.label); }

  /* ---- Build the widget ---- */
  root.innerHTML = '';
  var intro = el('p', 'rm-intro', root);
  intro.textContent = 'Pick a theme to see where it sits in the maize genome and which projects it covers.';

  var chipRow = el('div', 'rm-chips', root);
  chipRow.setAttribute('role', 'group');
  chipRow.setAttribute('aria-label', 'Filter research projects by theme');
  var chips = {};
  function addChip(id, label, color) {
    var b = el('button', 'rm-chip', chipRow);
    b.type = 'button';
    if (color) {
      var dot = el('span', 'rm-dot', b);
      dot.style.background = color;
      dot.setAttribute('aria-hidden', 'true');
    }
    el('span', null, b).textContent = label;
    b.addEventListener('click', function () { select(id, true); });
    chips[id] = b;
  }
  addChip('all', 'All themes', null);
  themes.forEach(function (t) { addChip(t.id, t.label, t.color); });

  var body = el('div', 'rm-body', root);
  var figure = el('div', 'rm-figure', body);
  el('div', 'rm-genome', figure).textContent = data.genome_label || 'Maize genome';
  var kary = el('div', 'rm-karyotype', figure);
  kary.setAttribute('role', 'img');

  var chroms = lens.map(function (len, i) {
    var col = el('div', 'rm-chrom', kary);
    var wrap = el('div', 'rm-barwrap', col);
    wrap.style.height = (len / maxLen * 100) + '%';
    var bar = el('div', 'rm-bar', wrap);
    el('div', 'rm-num', col).textContent = String(i + 1);
    return { wrap: wrap, bar: bar };
  });

  var marks = loci.map(function (l) {
    var c = chroms[l.chr - 1];
    if (!c) return null;
    var len = Number(l.chr_length_mb || lens[l.chr - 1]);
    var top = Math.max(0, Math.min(100, Number(l.start_mb) / len * 100));
    var h = Math.max(0, (Number(l.end_mb) - Number(l.start_mb)) / len * 100);
    var m = el('span', 'rm-mark', c.bar);
    m.style.top = top + '%';
    m.style.height = h + '%';
    m.title = l.label + ', chromosome ' + l.chr;
    var tag = el('span', 'rm-tag', c.wrap);
    tag.style.top = (top + h / 2) + '%';
    tag.innerHTML = locusName(l);
    return { locus: l, mark: m, tag: tag, chrom: c };
  }).filter(Boolean);

  var caption = el('div', 'rm-caption', body);
  var status = el('p', 'rm-status', root);
  status.setAttribute('aria-live', 'polite');

  /* ---- Theme tags on each project section ---- */
  var sectionThemes = {};
  themes.forEach(function (t) {
    t.sections.forEach(function (id) { (sectionThemes[id] = sectionThemes[id] || []).push(t); });
  });
  var sections = Object.keys(sectionThemes).map(function (id) {
    var s = document.getElementById(id);
    if (!s) return null;
    var heading = s.querySelector('h1, h2, h3, h4') || s;
    var tags = document.createElement('div');
    tags.className = 'rm-section-tags';
    sectionThemes[id].forEach(function (t) {
      var b = el('button', 'rm-pill', tags);
      b.type = 'button';
      b.style.borderColor = t.color;
      var dot = el('span', 'rm-dot', b);
      dot.style.background = t.color;
      dot.setAttribute('aria-hidden', 'true');
      el('span', null, b).textContent = t.label;
      b.addEventListener('click', function () {
        select(t.id, true);
        root.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
    heading.insertAdjacentElement('afterend', tags);
    return { el: s, themes: sectionThemes[id].map(function (t) { return t.id; }) };
  }).filter(Boolean);

  /* ---- Selection ---- */
  function select(id, updateHash) {
    if (id !== 'all' && !themeById[id]) id = 'all';
    var t = themeById[id];
    Object.keys(chips).forEach(function (k) { chips[k].setAttribute('aria-pressed', k === id ? 'true' : 'false'); });

    chroms.forEach(function (c) {
      c.bar.style.background = t && t.genome_wide ? rgba(t.color, 0.45) : BAR;
      c.bar.style.boxShadow = 'none';
    });
    var shown = [];
    marks.forEach(function (m) {
      var inTheme = id === 'all' || m.locus.themes.indexOf(id) !== -1;
      var color = id === 'all' ? (themeById[m.locus.themes[0]] || {}).color || '#33691e' : (inTheme ? t.color : GREY);
      m.mark.style.background = color;
      m.tag.style.display = inTheme ? '' : 'none';
      if (inTheme) {
        shown.push(m.locus);
        if (id !== 'all') m.chrom.bar.style.boxShadow = '0 0 0 2px ' + t.color;
      }
    });

    var html;
    if (!t) {
      html = '<p class="rm-title">All research themes</p>' +
        '<p>Each mark is a locus from our published work. Choose a theme to filter the projects below.</p>';
    } else {
      html = '<p class="rm-title"><span class="rm-dot" style="background:' + t.color + '"></span>' + esc(t.label) + '</p>' +
        '<p>' + md(t.summary || '') + '</p>';
    }
    if (shown.length) {
      html += '<p class="rm-loci">On the map: ' + shown.map(function (l) {
        var name = locusName(l);
        return (l.url ? '<a href="' + esc(l.url) + '">' + name + '</a>' : name) + ' (chromosome ' + l.chr + ')';
      }).join(', ') + '</p>';
    } else if (t && t.genome_wide) {
      html += '<p class="rm-loci">This work spans the whole genome.</p>';
    } else if (t) {
      html += '<p class="rm-loci">Loci for this theme are still being mapped.</p>';
    }
    caption.innerHTML = html;
    kary.setAttribute('aria-label', (t ? t.label + ': ' : '') + (shown.length ?
      'loci ' + shown.map(function (l) { return l.label + ' on chromosome ' + l.chr; }).join(', ') :
      'no mapped loci shown') + '.');

    var count = 0;
    sections.forEach(function (s) {
      var on = id === 'all' || s.themes.indexOf(id) !== -1;
      s.el.hidden = !on;
      if (on) count++;
    });
    status.innerHTML = '';
    if (t) {
      status.appendChild(document.createTextNode('Showing ' + count + ' of ' + sections.length + ' projects. '));
      var reset = el('button', 'rm-reset', status);
      reset.type = 'button';
      reset.textContent = 'Show all projects';
      reset.addEventListener('click', function () { select('all', true); });
    }

    if (updateHash && window.history && history.replaceState) {
      history.replaceState(null, '', id === 'all' ? location.pathname : '#theme-' + id);
    }
  }

  var m = /^#theme-([\w-]+)$/.exec(location.hash);
  select(m ? m[1] : 'all', false);
  }
})();
