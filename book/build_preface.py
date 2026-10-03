#!/usr/bin/env python3
"""Generate the static Preface page from the PDF's canonical Markdown source."""

from __future__ import annotations

import argparse
import html
import re
from pathlib import Path


DESCRIPTION = (
    "Amit Rathore on the path from building software and networks to Mind of Agents, "
    "a field guide for independent, interconnected agents."
)


def replace_once(source: str, old: str, new: str) -> str:
    if source.count(old) != 1:
        raise ValueError(f"Expected exactly one occurrence of {old!r}")
    return source.replace(old, new, 1)


def replace_attribute(source: str, prefix: str, value: str) -> str:
    pattern = re.compile(re.escape(prefix) + r'[^"\n]*"')
    result, count = pattern.subn(lambda match: prefix + html.escape(value, quote=True) + '"', source, count=1)
    if count != 1:
        raise ValueError(f"Missing metadata attribute: {prefix}")
    return result


def preface_paragraphs(path: Path) -> list[str]:
    sections = path.read_text(encoding="utf-8").strip().split("\n\n")
    if sections[0] != "# Preface" or sections[-1] != "Amit Rathore":
        raise ValueError("Unexpected preface structure")
    return sections[1:-1]


def render(repo: Path) -> str:
    about = (repo / "docs/about/index.html").read_text(encoding="utf-8")
    head, rest = about.split('<main id="main">', 1)
    _, footer = rest.split("</main>", 1)
    head = replace_once(head, "<title>About the Project · Mind of Agents</title>",
                        "<title>Why I Wrote This · Mind of Agents</title>")
    head = replace_attribute(head, '<meta name="description" content="', DESCRIPTION)
    head = replace_attribute(head, '<link rel="canonical" href="', "https://mindofagents.com/preface/")
    head = replace_attribute(head, '<meta property="og:title" content="', "Why I Wrote This · Mind of Agents")
    head = replace_attribute(head, '<meta property="og:description" content="', DESCRIPTION)
    head = replace_attribute(head, '<meta property="og:url" content="', "https://mindofagents.com/preface/")
    head = replace_once(head, '<a href="../preface/">Why</a>',
                        '<a href="../preface/" aria-current="page">Why</a>')
    head = replace_once(head, '<a href="../about/" aria-current="page">About</a>',
                        '<a href="../about/">About</a>')

    paragraph_nodes = []
    for i, text in enumerate(preface_paragraphs(repo / "book/preface.md")):
        class_attr = ' class="drop"' if i == 0 else ""
        paragraph_nodes.append(f"<p{class_attr}>{html.escape(text)}</p>")
    paragraphs = "\n".join(paragraph_nodes)
    main = (
        '<main id="main">\n'
        '<section class="page-top"><div class="wrap"><span class="eyebrow kicker">Preface / Amit Rathore</span>'
        '<h1>Why I Wrote<br>This.</h1>'
        '<p>The path from building software and networks to asking how independent minds can work together.</p>'
        '</div></section>\n'
        '<section class="page-body"><div class="wrap"><article class="prose preface-prose">'
        '<div class="preface-copy">\n'
        + paragraphs + '\n<p class="preface-signature">Amit Rathore</p>\n</div>'
        '<div class="exercise"><h2>Continue with Chapter 01.</h2>'
        '<p>Begin with the distinction at the heart of this book: an agent is not the mind.</p>'
        '<a class="button" href="../read/the-agent-is-not-the-mind/">Read the first chapter ↗</a>'
        '</div><a class="text-link" href="../read/">Explore all chapters ↗</a>'
        '</article></div></section>\n</main>'
    )
    return head + main + footer


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="Fail if the generated page is stale")
    parser.add_argument("--repo", type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    repo = args.repo.resolve()
    target = repo / "docs/preface/index.html"
    expected = render(repo)
    if args.check:
        if not target.exists() or target.read_text(encoding="utf-8") != expected:
            raise SystemExit("Preface page is out of date; run python3 book/build_preface.py")
        print("Preface page matches book/preface.md")
    else:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(expected, encoding="utf-8")
        print(f"Built {target}")


if __name__ == "__main__":
    main()
