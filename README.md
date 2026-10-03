# Mind of Agents

An open field guide to the philosophy and design of agentic minds. The site is a companion to the book. Opentangle is one implementation of these ideas, and Agents of Mind is a related builder community.

## Preview

The site is dependency free static HTML, CSS, SVG, and JavaScript. From this repository:

```sh
python3 -m http.server 8000 --directory docs
```

Open <http://localhost:8000/>.

## GitHub Pages

The site is published from `main` and `/docs` at <https://mindofagents.com/>. The `docs/CNAME` file declares the custom domain. Canonical and social metadata use the same URL.

## Contents

- `docs/index.html` — landing page
- `docs/read/` — book outline and published chapters
- `docs/protocol/` — interactive architecture and research notes
- `docs/design/` — private, in-browser design exercise
- `docs/about/` — project relationship and scope
- `docs/assets/og-mind-of-agents.png` — social image
- `docs/assets/mark.svg` — favicon and site mark

The social image is intentionally a raster asset; the interface illustration and favicon are SVG. The design exercise stores and transmits no answers.
