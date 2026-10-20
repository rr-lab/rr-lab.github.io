/* Photo Album: the year filter and a viewer for full-size photos.
   photos.Rmd builds the markup from photos.yml; without this script the year buttons
   still jump to each year and every photo still opens on its own. */
(function () {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    var root = document.getElementById('photo-album');
    if (!root) return;
    var buttons = [].slice.call(root.querySelectorAll('.pa-year'));
    var sections = [].slice.call(root.querySelectorAll('.pa-section'));
    var status = root.querySelector('.pa-status');

    /* ---- Year filter: photos.html#2024 shows only 2024 ---- */
    function select(year, updateHash) {
      if (!sections.some(function (s) { return s.getAttribute('data-year') === year; })) year = 'all';
      sections.forEach(function (s) { s.hidden = year !== 'all' && s.getAttribute('data-year') !== year; });
      buttons.forEach(function (b) {
        b.setAttribute('aria-current', b.getAttribute('data-year') === year ? 'true' : 'false');
      });
      status.textContent = '';
      if (year !== 'all') {
        var n = root.querySelectorAll('.pa-section[data-year="' + year + '"] .pa-item').length;
        status.appendChild(document.createTextNode(
          'Showing ' + n + (n === 1 ? ' photo' : ' photos') + ' from ' + year + '. '));
        var all = document.createElement('a');
        all.href = '#photo-album';
        all.textContent = 'Show all years';
        all.addEventListener('click', function (e) { e.preventDefault(); select('all', true); });
        status.appendChild(all);
      }
      if (updateHash && window.history && history.replaceState) {
        history.replaceState(null, '', year === 'all' ? location.pathname : '#' + year);
      }
    }
    buttons.forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.preventDefault();
        select(b.getAttribute('data-year'), true);
      });
    });
    function fromHash() {
      var m = /^#(\d{4})$/.exec(location.hash);
      return m ? m[1] : 'all';
    }
    window.addEventListener('hashchange', function () { select(fromHash(), false); });
    select(fromHash(), false);

    /* ---- Viewer: one photo at full size; arrows move through that year ---- */
    var dialog = document.createElement('dialog');
    if (typeof dialog.showModal !== 'function') return;
    dialog.className = 'pa-lightbox';
    dialog.setAttribute('aria-label', 'Photo viewer');
    dialog.innerHTML =
      '<div class="pa-lb-inner">' +
      '<img class="pa-lb-img" alt="">' +
      '<p class="pa-lb-cap"></p>' +
      '<p class="pa-lb-count"></p>' +
      '<button type="button" class="pa-lb-btn pa-lb-prev" aria-label="Previous photo">&#8249;</button>' +
      '<button type="button" class="pa-lb-btn pa-lb-next" aria-label="Next photo">&#8250;</button>' +
      '<button type="button" class="pa-lb-btn pa-lb-close" aria-label="Close" autofocus>&#215;</button>' +
      '</div>';
    document.body.appendChild(dialog);
    var img = dialog.querySelector('.pa-lb-img');
    var cap = dialog.querySelector('.pa-lb-cap');
    var count = dialog.querySelector('.pa-lb-count');
    var list = [];
    var index = 0;

    function href(item) { return item.querySelector('.pa-open').getAttribute('href'); }
    function show(i) {
      index = (i + list.length) % list.length;
      var item = list[index];
      img.src = href(item);
      img.alt = item.querySelector('img').alt;
      cap.innerHTML = item.querySelector('figcaption').innerHTML;
      count.textContent = item.closest('.pa-section').getAttribute('data-year') + ' · ' +
        (index + 1) + ' of ' + list.length;
      [index - 1, index + 1].forEach(function (j) {   // load the neighbours ahead of time
        new Image().src = href(list[(j + list.length) % list.length]);
      });
    }
    root.addEventListener('click', function (e) {
      var link = e.target.closest ? e.target.closest('.pa-open') : null;
      if (!link || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      var item = link.closest('.pa-item');
      list = [].slice.call(item.closest('.pa-section').querySelectorAll('.pa-item'));
      show(list.indexOf(item));
      document.documentElement.classList.add('pa-viewing');
      dialog.showModal();
    });
    dialog.querySelector('.pa-lb-prev').addEventListener('click', function () { show(index - 1); });
    dialog.querySelector('.pa-lb-next').addEventListener('click', function () { show(index + 1); });
    // Undo the scroll lock as soon as the viewer closes, without waiting for the
    // dialog's own close event (browsers may delay it in background tabs).
    function cleanup() {
      document.documentElement.classList.remove('pa-viewing');
      img.removeAttribute('src');
    }
    function closeViewer() {
      if (dialog.open) dialog.close();
      cleanup();
    }
    dialog.querySelector('.pa-lb-close').addEventListener('click', closeViewer);
    dialog.addEventListener('cancel', cleanup);         // Esc
    dialog.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); show(index - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); show(index + 1); }
    });
    dialog.addEventListener('click', function (e) {   // a click outside the photo closes it
      if (e.target === dialog || e.target.classList.contains('pa-lb-inner')) closeViewer();
    });
    var x0 = null;                                     // swipe on touch screens
    dialog.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    dialog.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0;
      x0 = null;
      if (Math.abs(dx) > 50) show(index + (dx < 0 ? 1 : -1));
    });
    dialog.addEventListener('close', cleanup);
  }
})();
