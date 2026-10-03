# Book edition

`build_book.py` assembles the published Mind of Agents chapters from `docs/read/` into one 6 × 9 inch PDF. The chapter list is deliberately explicit so a chapter cannot enter the download accidentally. The current edition includes all twelve chapters. The PDF includes a preface, table of contents, print Anatomy appendix, subject index with page links, and author information.

## Build

On Amit's Mac, with Python 3, ReportLab, and Georgia and Arial system fonts:

```sh
python3 book/build_book.py
```

The output is `docs/downloads/mind-of-agents-current-edition.pdf`. Review the preface and rendered PDF before committing or publishing a new edition.

For visual inspection, use Poppler:

```sh
pdftoppm -f 1 -l 5 -scale-to 900 -png docs/downloads/mind-of-agents-current-edition.pdf /tmp/moa-preview
```

## Preface source notes

The first-person preface is an editorial draft for Amit Rathore's review. Its factual grounding comes from his [career timeline](https://amitrathore.com/), [Vision vs Obsession](https://www.awake.ventures/p/vision-vs-obsession-ear2samu61n1n6s2x) (2021), [ORGtype and A-OKRs](https://www.awake.ventures/p/orgtype-and-a-okrs-89cbidyi8fdyilxdi) (2021), [From Quintype to Awake Press](https://www.awake.ventures/p/from-quintype-to-awake-press-vgsg7nok87ej8di3r) (2021), and the Intergraph Lightpaper authored by Amit Rathore (22 May 2025). The public book presents the philosophy independently of any one implementation; Opentangle is named as one way to explore it in software.

## Preface page

`book/preface.md` is the single source for the PDF preface and `docs/preface/index.html`. After editing the preface or the shared About-page header/footer, regenerate and check the web page:

```sh
python3 book/build_preface.py
python3 book/build_preface.py --check
```
