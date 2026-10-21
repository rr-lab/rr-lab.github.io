/* People page filters: by role and by research theme.
   people.Rmd tags each card with data-group and data-themes (from people.yml) and inlines the
   filter labels; this builds the buttons. Filters combine, and the address keeps the choice
   (people.html#role=postdocs&theme=metabolism). Without this script everyone is listed. */
(function () {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    var root = document.getElementById('people-filter');
    var dataEl = document.getElementById('people-filter-data');
    if (!root || !dataEl) return;
    var cards = [].slice.call(document.querySelectorAll('.person-card[data-group]'));
    if (!cards.length) return;
    var data = JSON.parse(dataEl.textContent);
    var list = function (x) { return x == null ? [] : (Array.isArray(x) ? x : [x]); };
    var state = { role: 'all', theme: 'all' };

    function el(tag, cls, parent) {
      var e = document.createElement(tag);
      if (cls) e.className = cls;
      if (parent) parent.appendChild(e);
      return e;
    }
    function themesOf(card) {
      return (card.getAttribute('data-themes') || '').split(/\s+/).filter(Boolean);
    }
    function matches(card, role, theme) {
      return (role === 'all' || card.getAttribute('data-group') === role) &&
        (theme === 'all' || themesOf(card).indexOf(theme) !== -1);
    }
    function count(key, id) {
      return cards.filter(function (c) {
        return key === 'role' ? matches(c, id, 'all') : matches(c, 'all', id);
      }).length;
    }

    /* ---- One row of buttons per filter ---- */
    function row(label, items, key) {
      var wrap = el('div', 'pf-row', root);
      el('span', 'pf-label', wrap).textContent = label;
      var group = el('div', 'pf-chips', wrap);
      group.setAttribute('role', 'group');
      group.setAttribute('aria-label', 'Filter people by ' + label.toLowerCase());
      var buttons = {};
      items.forEach(function (it) {
        var b = el('button', 'pf-chip', group);
        b.type = 'button';
        if (it.color) {
          var dot = el('span', 'pf-dot', b);
          dot.style.background = it.color;
          dot.setAttribute('aria-hidden', 'true');
        }
        el('span', null, b).textContent = it.label;
        el('span', 'pf-n', b).textContent = it.id === 'all' ? cards.length : count(key, it.id);
        b.addEventListener('click', function () {
          state[key] = it.id;
          apply(true);
        });
        buttons[it.id] = b;
      });
      return buttons;
    }
    var roles = [{ id: 'all', label: 'Everyone' }].concat(
      list(data.groups).filter(function (g) { return count('role', g.id) > 0; }));
    var themes = [{ id: 'all', label: 'All themes' }].concat(list(data.themes));
    var roleButtons = row('Role', roles, 'role');
    var themeButtons = row('Research theme', themes, 'theme');
    var status = el('p', 'pf-status', root);
    status.setAttribute('aria-live', 'polite');

    /* ---- Filtering ---- */
    function apply(updateHash) {
      var shown = 0;
      cards.forEach(function (c) {
        var on = matches(c, state.role, state.theme);
        c.hidden = !on;
        if (on) shown++;
      });
      Object.keys(roleButtons).forEach(function (k) {
        roleButtons[k].setAttribute('aria-pressed', k === state.role ? 'true' : 'false');
      });
      Object.keys(themeButtons).forEach(function (k) {
        themeButtons[k].setAttribute('aria-pressed', k === state.theme ? 'true' : 'false');
      });
      status.textContent = '';
      if (state.role !== 'all' || state.theme !== 'all') {
        status.appendChild(document.createTextNode(shown ?
          'Showing ' + shown + (shown === 1 ? ' person. ' : ' people. ') :
          'No one matches both filters. '));
        var reset = el('button', 'pf-reset', status);
        reset.type = 'button';
        reset.textContent = 'Show everyone';
        reset.addEventListener('click', function () {
          state.role = 'all';
          state.theme = 'all';
          apply(true);
        });
      }
      if (updateHash && window.history && history.replaceState) {
        var parts = [];
        if (state.role !== 'all') parts.push('role=' + state.role);
        if (state.theme !== 'all') parts.push('theme=' + state.theme);
        history.replaceState(null, '', parts.length ? '#' + parts.join('&') : location.pathname);
      }
    }
    function fromHash() {
      state.role = 'all';
      state.theme = 'all';
      location.hash.replace(/^#/, '').split('&').forEach(function (kv) {
        var m = /^(role|theme)=([\w-]+)$/.exec(kv);
        if (m) state[m[1]] = m[2];
      });
      if (!roleButtons[state.role]) state.role = 'all';
      if (!themeButtons[state.theme]) state.theme = 'all';
    }
    window.addEventListener('hashchange', function () { fromHash(); apply(false); });
    fromHash();
    apply(false);
  }
})();
