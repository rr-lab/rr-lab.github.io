/* People page role filter. people.Rmd tags each card with data-group (from people.yml) and
   inlines the role labels; this builds the buttons above the grid. The address keeps the
   choice (people.html#role=postdocs). Without this script everyone is listed. */
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
    var role = 'all';

    function el(tag, cls, parent) {
      var e = document.createElement(tag);
      if (cls) e.className = cls;
      if (parent) parent.appendChild(e);
      return e;
    }
    function count(id) {
      return cards.filter(function (c) { return c.getAttribute('data-group') === id; }).length;
    }

    /* ---- The buttons ---- */
    var wrap = el('div', 'pf-row', root);
    el('span', 'pf-label', wrap).textContent = 'Role';
    var group = el('div', 'pf-chips', wrap);
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', 'Filter people by role');
    var buttons = {};
    [{ id: 'all', label: 'Everyone' }].concat(list(data.groups).filter(function (g) { return count(g.id) > 0; }))
      .forEach(function (it) {
        var b = el('button', 'pf-chip', group);
        b.type = 'button';
        el('span', null, b).textContent = it.label;
        el('span', 'pf-n', b).textContent = it.id === 'all' ? cards.length : count(it.id);
        b.addEventListener('click', function () { select(it.id, true); });
        buttons[it.id] = b;
      });
    var status = el('p', 'pf-status', root);
    status.setAttribute('aria-live', 'polite');

    /* ---- Filtering ---- */
    function select(id, updateHash) {
      role = buttons[id] ? id : 'all';
      var shown = 0;
      cards.forEach(function (c) {
        var on = role === 'all' || c.getAttribute('data-group') === role;
        c.hidden = !on;
        if (on) shown++;
      });
      Object.keys(buttons).forEach(function (k) {
        buttons[k].setAttribute('aria-pressed', k === role ? 'true' : 'false');
      });
      status.textContent = '';
      if (role !== 'all') {
        status.appendChild(document.createTextNode(
          'Showing ' + shown + (shown === 1 ? ' person. ' : ' people. ')));
        var reset = el('button', 'pf-reset', status);
        reset.type = 'button';
        reset.textContent = 'Show everyone';
        reset.addEventListener('click', function () { select('all', true); });
      }
      if (updateHash && window.history && history.replaceState) {
        history.replaceState(null, '', role === 'all' ? location.pathname : '#role=' + role);
      }
    }
    function fromHash() {
      var m = /^#role=([\w-]+)$/.exec(location.hash);
      return m ? m[1] : 'all';
    }
    window.addEventListener('hashchange', function () { select(fromHash(), false); });
    select(fromHash(), false);
  }
})();
