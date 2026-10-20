/* Dark mode toggle at the end of the top menu. The theme itself is set before the page
   draws by assets/theme-head.html; this adds the button, remembers the visitor's choice
   and, until they choose, follows their system setting. */
(function () {
  var KEY = 'gemma-theme';
  var root = document.documentElement;
  var system = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  var button = null;
  var icon = null;

  function saved() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function isDark() { return root.getAttribute('data-theme') === 'dark'; }
  function apply(dark) {
    if (dark) root.setAttribute('data-theme', 'dark');
    else root.removeAttribute('data-theme');
    if (!button) return;
    button.setAttribute('aria-pressed', dark ? 'true' : 'false');
    button.title = dark ? 'Switch to light mode' : 'Switch to dark mode';
    icon.className = 'fa-solid ' + (dark ? 'fa-sun' : 'fa-moon');
  }

  if (system && system.addEventListener) {
    system.addEventListener('change', function (e) { if (!saved()) apply(e.matches); });
  }

  function init() {
    var menu = document.querySelector('.navbar .navbar-nav');
    if (!menu) return;
    var item = document.createElement('li');
    item.className = 'theme-item';
    button = document.createElement('button');
    button.type = 'button';
    button.className = 'theme-toggle';
    button.setAttribute('aria-label', 'Dark mode');
    icon = document.createElement('i');
    icon.setAttribute('aria-hidden', 'true');
    var label = document.createElement('span');
    label.className = 'theme-label';
    label.setAttribute('aria-hidden', 'true');
    label.textContent = 'Dark mode';   // shown in the folded menu on small screens
    button.appendChild(icon);
    button.appendChild(label);
    button.addEventListener('click', function () {
      var dark = !isDark();
      apply(dark);
      try { localStorage.setItem(KEY, dark ? 'dark' : 'light'); } catch (e) {}
    });
    item.appendChild(button);
    menu.appendChild(item);
    apply(isDark());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
