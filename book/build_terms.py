#!/usr/bin/env python3
"""Generate docs/assets/terms.js: inline glossary tooltips for key terms.

Definitions are the first sentence of each entry on docs/glossary/index.html,
so the glossary stays the single source of truth. Re-run after editing it.
"""
import html as htmllib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "docs"
# glossary id -> regex (matched case-insensitively on whole words)
TERMS = {
    "agentic-mind": r"agentic minds?",
    "shared-mind": r"shared minds?",
    "provenance": r"provenance",
    "protocol": r"protocols?",
    "reflection": r"reflection",
    "mandate": r"mandates?",
    "delegation": r"delegation",
    "attribution": r"attribution",
    "interoperability": r"interoperability",
    "human-oversight": r"human oversight",
}

RUNTIME = r"""(() => {
  const TERMS = __DATA__;
  const SCOPE = '.prose, .home-example, .section-intro, .protocol-hero-aside, .protocol-intro, .hero-copy .support';
  const SKIP = 'a, button, h1, h2, h3, h4, blockquote, .term, script, style, svg, label, .exercise';
  const base = (document.querySelector('script[src*="assets/terms.js"]').getAttribute('src') || '').replace(/assets\/terms\.js.*$/, '');
  const roots = [...document.querySelectorAll(SCOPE)];
  if (!roots.length) return;
  const linked = new Set([...document.querySelectorAll('a[href*="glossary/#"]')].map(a => a.getAttribute('href').split('#')[1]));
  for (const [id, entry] of Object.entries(TERMS)) {
    if (linked.has(id)) continue;
    const re = new RegExp('\\b(' + entry.pattern + ')\\b', 'i');
    let done = false;
    for (const root of roots) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: n => n.parentElement.closest(SKIP) ? NodeFilter.FILTER_REJECT : re.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP
      });
      const node = walker.nextNode();
      if (!node) continue;
      const m = re.exec(node.nodeValue);
      const a = document.createElement('a');
      a.className = 'term';
      a.href = base + 'glossary/#' + id;
      a.dataset.def = entry.def;
      a.setAttribute('aria-description', entry.def);
      a.textContent = m[0];
      const after = node.splitText(m.index);
      after.nodeValue = after.nodeValue.slice(m[0].length);
      node.parentNode.insertBefore(a, after);
      done = true;
      break;
    }
    if (done) continue;
  }
  const place = el => {
    const w = Math.min(280, innerWidth * 0.8), r = el.getBoundingClientRect();
    const left = Math.max(12, Math.min(r.left + r.width / 2 - w / 2, innerWidth - w - 12));
    el.style.setProperty('--tt-left', (left - r.left) + 'px');
  };
  document.querySelectorAll('.term').forEach(el => {
    el.addEventListener('mouseenter', () => place(el));
    el.addEventListener('focus', () => place(el));
  });
})();
"""

def first_sentence(text):
    text = re.sub(r"<[^>]+>", "", htmllib.unescape(text)).strip()
    m = re.match(r"(.+?[.!?])(\s|$)", text)
    return m.group(1) if m else text

def main():
    g = (ROOT / "glossary" / "index.html").read_text()
    defs = {m.group(1): first_sentence(m.group(3))
            for m in re.finditer(r'id="([^"]+)"><dt>([^<]+)</dt><dd>(.*?)</dd>', g)}
    data = {i: {"pattern": p, "def": defs[i]} for i, p in TERMS.items()}
    js = RUNTIME.replace("__DATA__", json.dumps(data, ensure_ascii=False, indent=2))
    (ROOT / "assets" / "terms.js").write_text(js)
    for i, d in data.items():
        print(f"{i}: {d['def']}")

if __name__ == "__main__":
    main()
