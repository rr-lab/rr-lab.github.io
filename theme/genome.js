// "Stories in the genome" panel on the home page.
//
// Reads the stories JSON that theme/stories.lua writes from _data/stories.yml
// and draws the story buttons, the B73 karyotype and the detail panel.
// Picking a story redraws in place and updates the URL hash (#story-<id>),
// so a story can be linked to directly.

(function () {
  "use strict";

  // B73 chromosome lengths in Mb, chromosomes 1 to 10.
  var LENGTHS = [308, 244, 238, 250, 226, 181, 186, 182, 163, 152];
  var MAX_LEN = Math.max.apply(null, LENGTHS);
  var MUTED = "#8A97A5";

  var root = document.getElementById("genome-panel");
  var source = document.getElementById("genome-stories");
  if (!root || !source) return;

  // Lua writes an empty list as {}, so make sure list fields are arrays.
  function asArray(x) { return Array.isArray(x) ? x : []; }
  var stories = asArray(JSON.parse(source.textContent)).map(function (s) {
    ["loci", "genes", "people", "links"].forEach(function (k) { s[k] = asArray(s[k]); });
    return s;
  });
  if (!stories.length) return;

  function el(tag, cls, html) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (html != null) node.innerHTML = html;
    return node;
  }

  function pct(x) {
    return (x * 100).toFixed(2) + "%";
  }

  function mb(x) {
    return Math.round(x);
  }

  function hasCoords(locus) {
    return typeof locus.start === "number" && typeof locus.end === "number" &&
      locus.chr >= 1 && locus.chr <= LENGTHS.length;
  }

  function mappedLoci(story) {
    return story.loci.filter(hasCoords);
  }

  function plain(html) {
    var d = document.createElement("div");
    d.innerHTML = html;
    return d.textContent;
  }

  function joinWords(items) {
    if (items.length < 2) return items.join("");
    return items.slice(0, -1).join(", ") + " and " + items[items.length - 1];
  }

  function whereText(story) {
    var loci = mappedLoci(story);
    if (!loci.length) return "Not yet mapped";
    var chrs = [];
    loci.forEach(function (l) { if (chrs.indexOf(l.chr) < 0) chrs.push(l.chr); });
    var text;
    if (loci.length === 1) {
      var l = loci[0];
      text = "Chromosome " + l.chr + (l.end - l.start < 1
        ? ", at " + l.start.toFixed(1) + " Mb"
        : ", about " + mb(l.start) + " to " + mb(l.end) + " Mb");
    } else {
      text = (chrs.length === 1 ? "Chromosome " : "Chromosomes ") + joinWords(chrs.map(String));
    }
    return story.verified ? text : text + " (approximate position)";
  }

  // ---- Static frame ------------------------------------------------------

  root.innerHTML = "";

  var bar = el("div", "gp-bar");
  bar.appendChild(el("h2", "gp-kicker", "Stories in the genome"));
  var buttons = el("div", "gp-buttons");
  buttons.setAttribute("role", "group");
  buttons.setAttribute("aria-label", "Research stories");
  bar.appendChild(buttons);
  root.appendChild(bar);

  var body = el("div", "gp-body");
  var karyo = el("div", "gp-karyo");
  karyo.appendChild(el("div", "gp-kicker", "Maize genome, B73"));
  var chroms = el("div", "gp-chroms");
  chroms.setAttribute("role", "img");
  karyo.appendChild(chroms);
  karyo.appendChild(el("p", "gp-note",
    "Every story with a mapped locus leaves a mark. The selected story is in colour."));
  body.appendChild(karyo);

  var detail = el("div", "gp-detail");
  detail.setAttribute("aria-live", "polite");
  body.appendChild(detail);
  root.appendChild(body);

  var buttonById = {};
  stories.forEach(function (s) {
    var b = el("button", "gp-story");
    b.type = "button";
    b.style.setProperty("--story", s.color);
    b.appendChild(el("span", "gp-dot"));
    b.appendChild(el("span", null, s.label));
    b.addEventListener("click", function () { pick(s.id, true); });
    buttons.appendChild(b);
    buttonById[s.id] = b;
  });

  // ---- Drawing -----------------------------------------------------------

  function drawKaryotype(sel) {
    chroms.innerHTML = "";
    var marked = [];
    LENGTHS.forEach(function (len, i) {
      var n = i + 1;
      var col = el("div", "gp-chrom");
      var shape = el("div", "gp-chrom-body");
      shape.style.height = pct(len / MAX_LEN);
      var inSel = false;
      stories.forEach(function (s) {
        mappedLoci(s).forEach(function (l) {
          if (l.chr !== n) return;
          var on = s.id === sel.id;
          if (on) inSel = true;
          var m = el("span", "gp-mark");
          m.style.top = pct(l.start / len);
          m.style.height = pct((l.end - l.start) / len);
          m.style.background = on ? s.color : MUTED;
          shape.appendChild(m);
        });
      });
      if (inSel) {
        shape.classList.add("is-selected");
        marked.push(n);
      }
      col.appendChild(shape);
      col.appendChild(el("span", "gp-chrom-n", String(n)));
      chroms.appendChild(col);
    });
    chroms.setAttribute("aria-label",
      "Karyotype of the 10 B73 maize chromosomes. " +
      (marked.length
        ? plain(sel.label) + " is marked on chromosome" + (marked.length > 1 ? "s " : " ") + joinWords(marked.map(String)) + "."
        : plain(sel.label) + " is not yet mapped."));
  }

  function drawDetail(sel) {
    detail.innerHTML = "";
    detail.style.setProperty("--story", sel.color);
    detail.appendChild(el("div", "gp-kicker", whereText(sel)));

    var loci = mappedLoci(sel);
    // One zoom bar per chromosome, with every locus of the story on it.
    var byChr = {};
    var chrOrder = [];
    loci.forEach(function (l) {
      if (!byChr[l.chr]) { byChr[l.chr] = []; chrOrder.push(l.chr); }
      byChr[l.chr].push(l);
    });
    chrOrder.sort(function (a, b) { return a - b; }).forEach(function (chr) {
      var ls = byChr[chr];
      var len = LENGTHS[chr - 1];
      var named = ls.filter(function (l) { return l.gene; }).map(function (l) { return "<em>" + l.gene + "</em>"; });
      var zoom = el("div", "gp-zoom");
      var head = el("div", "gp-zoom-head");
      head.appendChild(el("span", null,
        "Chromosome " + chr + (named.length ? ", " + named.join(", ") : "")));
      head.appendChild(el("span", null, len + " Mb"));
      zoom.appendChild(head);
      var track = el("div", "gp-zoom-track");
      ls.forEach(function (l) {
        var hit = el("span", "gp-zoom-locus");
        hit.style.left = pct(l.start / len);
        hit.style.width = pct((l.end - l.start) / len);
        if (l.gene) hit.title = l.gene + ", " + l.start.toFixed(1) + " Mb";
        track.appendChild(hit);
      });
      zoom.appendChild(track);
      detail.appendChild(zoom);
    });

    if (sel.inversion && loci.length) {
      var inv = el("div", "gp-inversion");
      inv.appendChild(el("div", "gp-inv-std", "Standard →"));
      inv.appendChild(el("div", "gp-inv-flip", "← Inverted in highland maize"));
      inv.appendChild(el("div", "gp-inv-std", "Standard →"));
      detail.appendChild(inv);
    }

    if (!loci.length) detail.appendChild(el("div", "gp-unmapped"));

    detail.appendChild(el("h3", "gp-title", sel.title));
    detail.appendChild(el("p", "gp-story-text", sel.story));

    var dl = el("dl", "gp-facts");
    function fact(term, dd) {
      dl.appendChild(el("dt", null, term));
      dl.appendChild(dd);
    }
    var genes = el("dd", "gp-genes");
    sel.genes.forEach(function (g) {
      var chip;
      if (g.href) {
        chip = el("a", "gp-gene", g.text);
        chip.href = g.href;
        chip.title = g.id + " on MaizeGDB";
      } else {
        chip = el("span", "gp-gene", g.text);
        if (/^\[.*\]$/.test(plain(g.text))) chip.classList.add("is-placeholder");
      }
      genes.appendChild(chip);
    });
    fact("Candidate genes", genes);
    fact("Status", el("dd", null, sel.status));
    fact("People", el("dd", null, sel.people.join(", ")));
    detail.appendChild(dl);

    if (sel.links.length) {
      var links = el("div", "gp-links");
      sel.links.forEach(function (l) {
        var a = el("a", null, l.text);
        a.href = l.href;
        links.appendChild(a);
      });
      detail.appendChild(links);
    }
  }

  function pick(id, updateHash) {
    var sel = stories.filter(function (s) { return s.id === id; })[0] || stories[0];
    stories.forEach(function (s) {
      buttonById[s.id].setAttribute("aria-pressed", s.id === sel.id ? "true" : "false");
    });
    drawKaryotype(sel);
    drawDetail(sel);
    if (updateHash && window.history && history.replaceState) {
      history.replaceState(null, "", "#story-" + sel.id);
    }
  }

  function fromHash() {
    var m = /^#story-(.+)$/.exec(window.location.hash);
    return m ? decodeURIComponent(m[1]) : stories[0].id;
  }

  window.addEventListener("hashchange", function () { pick(fromHash(), false); });
  pick(fromHash(), false);
})();
