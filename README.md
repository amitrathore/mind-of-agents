# Mind of Agents

An open field guide to the philosophy and design of agentic minds. The site is a companion to the book. OpenTangle is one implementation of these ideas, and Agents of Mind is a related builder community.

## Preview

The site is dependency free static HTML, CSS, SVG, and JavaScript. From this repository:

```sh
python3 -m http.server 8000 --directory docs
```

Open <http://localhost:8000/>.

## Publish with GitHub Pages

In the repository's **Settings → Pages**, choose **Deploy from a branch**, branch `main`, folder `/docs`. GitHub Pages will serve the site at `https://amitrathore.github.io/mind-of-agents/` if the repository is `amitrathore/mind-of-agents`.

The site currently assumes that URL for canonical and Open Graph metadata. If the GitHub owner, repository name, or domain differs, update the absolute URLs in the HTML files before publishing. Page links and asset paths are relative, so they work under either a project path or a custom domain.

## Contents

- `docs/index.html` — landing page
- `docs/read/` — book outline and first chapter
- `docs/design/` — private, in-browser design exercise
- `docs/about/` — project relationship and scope
- `docs/assets/og-mind-of-agents.png` — social image
- `docs/assets/mark.svg` — favicon and site mark

The social image is intentionally a raster asset; the interface illustration and favicon are SVG. The design exercise stores and transmits no answers.
