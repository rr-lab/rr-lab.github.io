#!/usr/bin/env python3
"""
Turn publications.bib into a formatted HTML fragment for publications.qmd.

Run automatically by Quarto before every render (see `pre-render` in
_quarto.yml). You should never need to run it by hand, but you can:

    python3 scripts/build_publications.py

Inputs
    publications.bib    one @article per paper (see UPDATING.md)
    _lab_authors.txt    surnames to bold automatically

Output
    _generated/publications-list.md
"""

from __future__ import annotations

import html
import os
import re
import sys
import unicodedata
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

BIB_PATH = os.path.join(ROOT, "publications.bib")
LAB_PATH = os.path.join(ROOT, "_lab_authors.txt")
OUT_DIR = os.path.join(ROOT, "_generated")
OUT_PATH = os.path.join(OUT_DIR, "publications-list.md")


# --------------------------------------------------------------------------
# BibTeX parsing
# --------------------------------------------------------------------------

ENTRY_RE = re.compile(r"@(\w+)\s*\{\s*([^,]+),", re.MULTILINE)


def parse_bib(text: str) -> list[dict]:
    """Minimal brace-counting BibTeX reader. Handles nested braces."""
    entries = []
    for m in ENTRY_RE.finditer(text):
        key = m.group(2).strip()
        i = text.index("{", m.start())
        depth = 0
        for j in range(i, len(text)):
            if text[j] == "{":
                depth += 1
            elif text[j] == "}":
                depth -= 1
                if depth == 0:
                    break
        else:
            raise ValueError(f"Unbalanced braces in entry '{key}'")

        body = text[text.index(",", m.start()) + 1 : j]
        fields = {"key": key}
        for name, value in parse_fields(body):
            fields[name.lower()] = value
        entries.append(fields)
    return entries


def parse_fields(body: str):
    """Yield (name, value) pairs from an entry body."""
    pos = 0
    n = len(body)
    while pos < n:
        eq = body.find("=", pos)
        if eq == -1:
            return
        name = body[pos:eq].strip().strip(",").strip()
        if not name or not re.fullmatch(r"[A-Za-z][\w-]*", name):
            return
        k = eq + 1
        while k < n and body[k] in " \t\r\n":
            k += 1
        if k >= n:
            return
        if body[k] == "{":
            depth = 0
            for j in range(k, n):
                if body[j] == "{":
                    depth += 1
                elif body[j] == "}":
                    depth -= 1
                    if depth == 0:
                        break
            value = body[k + 1 : j]
            pos = j + 1
        elif body[k] == '"':
            j = body.index('"', k + 1)
            value = body[k + 1 : j]
            pos = j + 1
        else:
            j = body.find(",", k)
            j = n if j == -1 else j
            value = body[k:j]
            pos = j
        comma = body.find(",", pos)
        pos = n if comma == -1 else comma + 1
        yield name, " ".join(value.split())


# --------------------------------------------------------------------------
# Lab-member name matching
# --------------------------------------------------------------------------


def tokens(s: str) -> list[str]:
    """Accent-stripped, punctuation-free, lowercase name parts."""
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = re.sub(r"[^0-9A-Za-z]+", " ", s).lower()
    return s.split()


def load_lab_surnames(path: str) -> list[list[str]]:
    if not os.path.exists(path):
        return []
    out = []
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            line = line.split("#", 1)[0].strip()
            if line:
                out.append(tokens(line))
    return out


def is_lab_member(author: str, surnames: list[list[str]]) -> bool:
    parts = tokens(author)
    for sn in surnames:
        k = len(sn)
        if k and any(parts[i : i + k] == sn for i in range(len(parts) - k + 1)):
            return True
    return False


# --------------------------------------------------------------------------
# Rendering
# --------------------------------------------------------------------------

EM_RE = re.compile(r"(?<!\*)\*([^*\n]+)\*(?!\*)")


def rich(text: str) -> str:
    """Escape HTML, then honour *markdown italics*."""
    return EM_RE.sub(r"<em>\1</em>", html.escape(text, quote=False))


def render_authors(raw: str, surnames: list[list[str]]) -> str:
    names = [a.strip() for a in re.split(r"\s+and\s+", raw) if a.strip()]
    out = []
    for name in names:
        safe = rich(name)
        out.append(f"<strong>{safe}</strong>" if is_lab_member(name, surnames) else safe)
    return ", ".join(out)


def render_entry(e: dict, surnames: list[list[str]]) -> str:
    title = rich(e.get("title", "Untitled"))
    url = html.escape(e.get("url", ""), quote=True)
    title_html = f'<a href="{url}">{title}</a>' if url else title

    links = []
    if e.get("pdf"):
        links.append(
            f'<a class="pub-tag" href="{html.escape(e["pdf"], quote=True)}">PDF</a>'
        )
    if e.get("code"):
        links.append(
            f'<a class="pub-tag" href="{html.escape(e["code"], quote=True)}">Code</a>'
        )
    if e.get("note"):
        links.append(
            f'<span class="pub-tag pub-tag-preprint">{rich(e["note"])}</span>'
        )
    links_html = f'\n    <div class="pub-links">{"".join(links)}</div>' if links else ""

    summary_html = ""
    if e.get("summary"):
        summary_html = (
            "\n    <details>"
            "\n      <summary>What we did</summary>"
            f'\n      <div class="pub-summary">{rich(e["summary"])}</div>'
            "\n    </details>"
        )

    num = html.escape(e.get("number", ""), quote=False)
    return (
        '<div class="pub">\n'
        f'  <div class="pub-num">{num}</div>\n'
        '  <div class="pub-body">\n'
        f'    <div class="pub-title">{title_html}</div>\n'
        f'    <div class="pub-authors">{render_authors(e.get("author", ""), surnames)}</div>'
        f"{links_html}{summary_html}\n"
        "  </div>\n"
        "</div>"
    )


def main() -> int:
    if not os.path.exists(BIB_PATH):
        sys.stderr.write(f"build_publications: {BIB_PATH} not found\n")
        return 1

    with open(BIB_PATH, encoding="utf-8") as fh:
        entries = parse_bib(fh.read())

    surnames = load_lab_surnames(LAB_PATH)

    by_year: dict[str, list[dict]] = defaultdict(list)
    for e in entries:
        by_year[e.get("year", "n.d.")].append(e)

    def sort_key(e: dict):
        try:
            return -int(e.get("number", 0))
        except ValueError:
            return 0

    years = sorted(by_year, key=lambda y: (y.isdigit(), y), reverse=True)

    chunks = [
        '<nav class="year-nav" aria-label="Jump to year">'
        + "".join(f'<a href="#y{y}">{y}</a>' for y in years)
        + "</nav>"
    ]

    for year in years:
        papers = sorted(by_year[year], key=sort_key)
        label = "paper" if len(papers) == 1 else "papers"
        chunks.append(
            f'<h2 class="pub-year" id="y{year}">{year}'
            f'<span class="pub-count">{len(papers)} {label}</span></h2>'
        )
        chunks.extend(render_entry(e, surnames) for e in papers)

    os.makedirs(OUT_DIR, exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as fh:
        fh.write("<!-- GENERATED by scripts/build_publications.py — do not edit -->\n")
        # A raw-HTML fence: without it Pandoc treats the indented markup inside
        # each <div> as an indented code block and prints the tags verbatim.
        fh.write("```{=html}\n")
        fh.write("\n".join(chunks))
        fh.write("\n```\n")

    sys.stderr.write(
        f"build_publications: {len(entries)} entries across "
        f"{len(by_year)} years -> {os.path.relpath(OUT_PATH, ROOT)}\n"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
