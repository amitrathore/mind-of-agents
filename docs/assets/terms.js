(() => {
  const TERMS = {
  "agentic-mind": {
    "pattern": "agentic minds?",
    "def": "A designed arrangement in which independent participants can share purpose and context, make decisions, act, remember outcomes, and learn."
  },
  "shared-mind": {
    "pattern": "shared minds?",
    "def": "A group or system with enough continuity and coordination to work as a whole while its participants retain distinct identities and agency."
  },
  "provenance": {
    "pattern": "provenance",
    "def": "The trace of where information or work came from, who contributed, and how it changed."
  },
  "protocol": {
    "pattern": "protocols?",
    "def": "An agreement about the moves available in a kind of work, who may make them, and what each move changes."
  },
  "reflection": {
    "pattern": "reflection",
    "def": "Looking at an action and its actual outcome, then updating the next decision."
  },
  "mandate": {
    "pattern": "mandates?",
    "def": "An explicit grant of authority for a particular purpose: who may act, on whose behalf, within which limits, and for how long."
  },
  "delegation": {
    "pattern": "delegation",
    "def": "Giving someone or something authority to act for another party within stated limits."
  },
  "attribution": {
    "pattern": "attribution",
    "def": "A claim or rule connecting an outcome to the people, actions, or sources that helped produce it."
  },
  "interoperability": {
    "pattern": "interoperability",
    "def": "The ability of different people, agents, tools, or systems to work together through understandable interfaces without having to share one implementation."
  },
  "human-oversight": {
    "pattern": "human oversight",
    "def": "A human ability to understand, approve, challenge, or stop consequential actions."
  }
};
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
