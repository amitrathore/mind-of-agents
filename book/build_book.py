#!/usr/bin/env python3
"""Build the review edition of Mind of Agents from its published HTML chapters."""

from __future__ import annotations

import argparse
import hashlib
import html
import re
from collections import defaultdict
from datetime import date
from html.parser import HTMLParser
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import inch
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfdoc
from reportlab.platypus import (
    BaseDocTemplate, Flowable, Frame, KeepTogether, NextPageTemplate,
    PageBreak, PageTemplate, Paragraph, Spacer, Table, TableStyle,
)


CHAPTERS = [
    ("the-agent-is-not-the-mind", "The Agent Is Not the Mind"),
    ("independence-and-interconnection", "Independence and Interconnection"),
    ("purpose-and-boundaries", "Purpose and Boundaries"),
    ("identity", "Identity"),
    ("memory-and-context", "Memory and Context"),
    ("protocols", "Protocols"),
    ("attention-and-decision", "Attention and Decision"),
    ("action-and-reflection", "Action and Reflection"),
    ("shared-minds", "Shared Minds"),
]
PARTS = {1: "PART I  /  WHAT MAKES A MIND?", 4: "PART II  /  THE ANATOMY OF AN AGENTIC MIND", 9: "PART III  /  MINDS TOGETHER"}
ANATOMY = [
    ("Identity", "A stable way to know who is involved and on whose behalf they act.", "Can you trace an action to an actor and their authority?"),
    ("Perception & attention", "Signals arrive from people, tools, and the world; attention selects a response.", "Why does one signal take priority over another?"),
    ("Meaning & context", "Shared terms and task context make facts interpretable together.", "Can agents distinguish a fact, inference, request, and instruction?"),
    ("Memory", "Revisable records of events, knowledge, decisions, and relationships carry work forward.", "What persists, who may retrieve it, and what may be forgotten?"),
    ("Imagination & planning", "Agents propose alternatives and compare possible paths before committing.", "Can the group see options and uncertainty before an irreversible move?"),
    ("Purpose & values", "Explicit goals and values guide tradeoffs.", "Whose purpose is served, and who can change it?"),
    ("Decision & authority", "A decision identifies who may choose, approve, refuse, or escalate.", "What requires human approval, and what authority was delegated?"),
    ("Protocols & boundaries", "Roles, permissions, consent, handoffs, and exit conditions make collaboration repeatable.", "What must be true before an action is allowed?"),
    ("Action & capabilities", "Tools, skills, and other agents change the world within actual permissions.", "What can this agent do, through which tool, and with what effects?"),
    ("Reflection & learning", "Outcomes are compared with expectations so behavior and rules can change.", "What changed because the last action succeeded or failed?"),
    ("Provenance & contribution", "A trace connects inputs, actions, outcomes, and contributors.", "Can someone see how their work affected an outcome?"),
    ("Time & resources", "Work consumes finite time, attention, compute, money, and other resources.", "When does work expire, and what keeps it sustainable?"),
]
INDEX_TERMS = [
    "accountability", "action", "agentic mind", "agents", "attention", "authority",
    "boundaries", "consent", "context", "contribution", "decision", "delegation",
    "governance", "identity", "independence", "learning", "memory", "Opentangle",
    "participants", "protocols", "provenance", "purpose", "reflection", "roles", "trust",
]

INK = colors.HexColor("#101629")
PAPER = colors.HexColor("#f6f3eb")
CORAL = colors.HexColor("#ee6c57")
MINT = colors.HexColor("#63cfb7")
SLATE = colors.HexColor("#53617b")
LIGHT = colors.HexColor("#e7e4db")
PAGE = (6 * inch, 9 * inch)

# ReportLab 4.x expects Python's newer hashlib.md5(usedforsecurity=...).
# The system Python on this Mac is 3.8 and lacks that keyword.
pdfdoc.md5 = lambda **kwargs: hashlib.md5()


class Node:
    def __init__(self, tag="", attrs=None):
        self.tag = tag
        self.attrs = dict(attrs or [])
        self.children = []

    def text(self):
        return "".join(c.text() if isinstance(c, Node) else c for c in self.children)

    def find(self, tag, class_name=None):
        if self.tag == tag and (class_name is None or class_name in self.attrs.get("class", "").split()):
            return self
        for child in self.children:
            if isinstance(child, Node):
                hit = child.find(tag, class_name)
                if hit:
                    return hit
        return None


class Parser(HTMLParser):
    VOID = {"br", "hr", "img", "input", "link", "meta", "source", "wbr"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Node("root")
        self.stack = [self.root]

    def handle_starttag(self, tag, attrs):
        node = Node(tag, attrs)
        self.stack[-1].children.append(node)
        if tag not in self.VOID:
            self.stack.append(node)

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i].tag == tag:
                del self.stack[i:]
                return

    def handle_data(self, data):
        self.stack[-1].children.append(data)


def parse_html(path):
    parser = Parser()
    parser.feed(path.read_text(encoding="utf-8"))
    return parser.root


def inline(node):
    if isinstance(node, str):
        return escape(node)
    body = "".join(inline(c) for c in node.children)
    if node.tag in ("strong", "b"):
        return f"<b>{body}</b>"
    if node.tag in ("em", "i"):
        return f"<i>{body}</i>"
    if node.tag == "a":
        href = node.attrs.get("href", "")
        if href.startswith("https://"):
            return f'<link href="{escape(href)}" color="#287d76">{body}</link>'
        return body
    if node.tag == "br":
        return "<br/>"
    return body


def markup(node):
    return "".join(inline(c) for c in node.children).strip()


def plain(node):
    return re.sub(r"\s+", " ", node.text()).strip()


def register_fonts():
    base = Path("/System/Library/Fonts/Supplemental")
    for name, filename in [
        ("Georgia", "Georgia.ttf"), ("Georgia-Bold", "Georgia Bold.ttf"),
        ("Georgia-Italic", "Georgia Italic.ttf"), ("Arial", "Arial.ttf"),
        ("Arial-Bold", "Arial Bold.ttf"),
    ]:
        pdfmetrics.registerFont(TTFont(name, str(base / filename)))
    pdfmetrics.registerFontFamily("Georgia", normal="Georgia", bold="Georgia-Bold", italic="Georgia-Italic", boldItalic="Georgia-Bold")
    pdfmetrics.registerFontFamily("Arial", normal="Arial", bold="Arial-Bold")


def styles():
    return {
        "body": ParagraphStyle("body", fontName="Georgia", fontSize=10.2, leading=15.1, textColor=INK, spaceAfter=8),
        "body_small": ParagraphStyle("body_small", fontName="Georgia", fontSize=9.4, leading=13.8, textColor=INK, spaceAfter=6),
        "h2": ParagraphStyle("h2", fontName="Arial-Bold", fontSize=15, leading=18, textColor=INK, spaceBefore=15, spaceAfter=9, keepWithNext=True),
        "chapter": ParagraphStyle("chapter", fontName="Arial-Bold", fontSize=27, leading=29.5, textColor=INK, spaceAfter=17, keepWithNext=True),
        "section": ParagraphStyle("section", fontName="Arial-Bold", fontSize=24, leading=27, textColor=INK, spaceAfter=19, keepWithNext=True),
        "eyebrow": ParagraphStyle("eyebrow", fontName="Arial-Bold", fontSize=8, leading=10, textColor=colors.HexColor("#bd5243"), spaceAfter=15, tracking=1.2),
        "quote": ParagraphStyle("quote", fontName="Georgia-Italic", fontSize=12.5, leading=18, textColor=INK, leftIndent=14, rightIndent=14, backColor=LIGHT, borderPadding=8, spaceBefore=8, spaceAfter=16),
        "exercise": ParagraphStyle("exercise", fontName="Arial-Bold", fontSize=12, leading=15, textColor=INK, spaceAfter=8),
        "note": ParagraphStyle("note", fontName="Georgia", fontSize=9, leading=13.5, textColor=SLATE, spaceAfter=7),
        "toc": ParagraphStyle("toc", fontName="Arial", fontSize=10.3, leading=15, textColor=INK),
        "index": ParagraphStyle("index", fontName="Georgia", fontSize=9.3, leading=13.4, textColor=INK, spaceAfter=4),
        "caption": ParagraphStyle("caption", fontName="Arial", fontSize=8.5, leading=12, textColor=SLATE, alignment=TA_CENTER),
        "cover_title": ParagraphStyle("cover_title", fontName="Arial-Bold", fontSize=43, leading=43, textColor=PAPER),
    }


class Label(Paragraph):
    def __init__(self, text, style, key=None, index_text=None, **kwargs):
        super().__init__(text, style, **kwargs)
        self.bookmark_key = key
        self.index_text = index_text or (re.sub(r"<[^>]+>", "", html.unescape(text)) if text else "")


class BookDoc(BaseDocTemplate):
    def __init__(self, filename):
        super().__init__(str(filename), pagesize=PAGE, leftMargin=0.69*inch, rightMargin=0.69*inch, topMargin=0.74*inch, bottomMargin=0.68*inch, title="Mind of Agents — Current Edition", author="Amit Rathore", subject="Philosophy and design of agentic minds")
        frame = Frame(self.leftMargin, self.bottomMargin, self.width, self.height, leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
        self.addPageTemplates([
            PageTemplate(id="cover", frames=[frame], onPage=self.cover),
            PageTemplate(id="body", frames=[frame], onPage=self.body_page),
        ])
        self.locations = {}
        self.index_locations = defaultdict(dict)
        self.current_chapter = None

    def cover(self, canvas, doc):
        canvas.saveState()
        w, h = PAGE
        canvas.setFillColor(INK); canvas.rect(0, 0, w, h, fill=1, stroke=0)
        canvas.setFillColor(CORAL); canvas.roundRect(0.68*inch, h-1.09*inch, 0.48*inch, 0.48*inch, 10, fill=1, stroke=0)
        canvas.setFillColor(INK); canvas.setFont("Arial-Bold", 22); canvas.drawCentredString(0.92*inch, h-0.99*inch, "M")
        canvas.setStrokeColor(MINT); canvas.setLineWidth(1.2)
        for offset in range(4):
            x = 2.8*inch + offset*0.49*inch
            canvas.circle(x, 3.3*inch + (offset%2)*0.28*inch, 0.16*inch, fill=0, stroke=1)
        canvas.line(2.95*inch, 3.38*inch, 4.2*inch, 3.58*inch)
        canvas.setFillColor(MINT); canvas.setFont("Arial-Bold", 8)
        canvas.drawString(0.7*inch, 0.7*inch, "AN OPEN FIELD GUIDE  /  CURRENT EDITION")
        canvas.restoreState()

    def body_page(self, canvas, doc):
        canvas.saveState()
        w, h = PAGE
        canvas.bookmarkPage(f"page-{doc.page - 1}")
        canvas.setFillColor(PAPER); canvas.rect(0, 0, w, h, fill=1, stroke=0)
        canvas.setStrokeColor(LIGHT); canvas.line(0.69*inch, h-0.57*inch, w-0.69*inch, h-0.57*inch)
        canvas.setFillColor(SLATE); canvas.setFont("Arial-Bold", 7.2)
        canvas.drawString(0.69*inch, h-0.48*inch, "MIND OF AGENTS")
        canvas.setFont("Arial", 7.2)
        canvas.drawRightString(w-0.69*inch, h-0.48*inch, "A FIELD GUIDE TO AGENTIC MINDS")
        canvas.setFont("Arial", 8)
        canvas.drawString(0.69*inch, 0.39*inch, "AMIT RATHORE")
        canvas.drawRightString(w-0.69*inch, 0.39*inch, str(doc.page - 1))
        canvas.restoreState()

    def afterFlowable(self, flowable):
        if isinstance(flowable, Label):
            if flowable.bookmark_key:
                self.canv.bookmarkPage(flowable.bookmark_key)
                self.canv.addOutlineEntry(re.sub(r"<[^>]+>", "", html.unescape(flowable.getPlainText())), flowable.bookmark_key, level=0)
                self.locations[flowable.bookmark_key] = self.page - 1
                self.current_chapter = flowable.getPlainText()
                if flowable.bookmark_key == "anatomy":
                    anatomy_text = " ".join(name for name, _, _ in ANATOMY).lower()
                    for term in INDEX_TERMS:
                        if term in ("agentic mind", "agents") or re.search(r"\b" + re.escape(term.lower()) + r"\b", anatomy_text):
                            self.index_locations[term].setdefault("Anatomy", self.page - 1)
            if flowable.index_text and self.page > 3:
                content = flowable.index_text.lower()
                for term in INDEX_TERMS:
                    if re.search(r"\b" + re.escape(term.lower()) + r"\b", content):
                        self.index_locations[term].setdefault(self.current_chapter or "Front matter", self.page - 1)


class AnatomyFigure(Flowable):
    """Print adaptation of the site's numbered anthropomorphic SVG."""
    def __init__(self, width=330, height=390):
        super().__init__(); self.width=width; self.height=height

    def draw(self):
        c=self.canv; c.saveState(); c.setFillColor(INK); c.roundRect(0,0,self.width,self.height,14,fill=1,stroke=0)
        c.setStrokeColor(MINT); c.setLineWidth(0.7)
        cx=self.width/2; cy=284
        c.setFillColor(colors.HexColor("#233b60")); c.circle(cx,cy,50,fill=1,stroke=1)
        c.roundRect(cx-56,77,112,150,26,fill=1,stroke=1)
        c.setLineWidth(17); c.setStrokeColor(colors.HexColor("#233b60"))
        for x1,y1,x2,y2 in [(cx-53,205,cx-88,105),(cx+53,205,cx+88,105),(cx-25,82,cx-33,20),(cx+25,82,cx+33,20)]: c.line(x1,y1,x2,y2)
        points=[(cx,329),(cx+40,290),(cx-40,290),(cx-28,264),(cx+28,264),(cx,211),(cx-30,168),(cx+30,168),(cx-88,105),(cx+88,105),(cx-32,46),(cx+32,46)]
        for i,(x,y) in enumerate(points,1):
            c.setFillColor(CORAL if i in (1,6,8) else MINT); c.circle(x,y,13,fill=1,stroke=0)
            c.setFillColor(INK); c.setFont("Arial-Bold",7.8); c.drawCentredString(x,y-2.8,f"{i:02d}")
        c.setFillColor(PAPER); c.setFont("Arial-Bold",7); c.drawString(15,self.height-19,"ONE MIND / MANY AGENTS")
        c.setFont("Arial",7); c.drawString(15,10,"INDEPENDENT MEMBERS  •  SHARED AGENCY  •  THE WORLD")
        c.restoreState()


def chapter_story(root, num, title, s):
    article = root.find("article", "prose")
    if not article: raise ValueError(f"No article.prose for {title}")
    story = [PageBreak(), Spacer(1, 9), Paragraph(PARTS.get(num, PARTS[max(k for k in PARTS if k <= num)]), s["eyebrow"]),
             Paragraph(f"CHAPTER {num:02d}", s["eyebrow"]), Label(escape(title), s["chapter"], f"chapter-{num}"), Spacer(1, 7)]
    for child in article.children:
        if not isinstance(child, Node): continue
        if child.tag == "p": story.append(Label(markup(child), s["body"], index_text=plain(child)))
        elif child.tag == "h2": story.append(Label(markup(child), s["h2"], index_text=plain(child)))
        elif child.tag == "blockquote": story.append(Paragraph(markup(child), s["quote"]))
        elif child.tag in ("ul", "ol"):
            for item in child.children:
                if isinstance(item,Node) and item.tag == "li":
                    story.append(Label("<font color='#ee6c57'>•</font>  "+markup(item), s["body"], index_text=plain(item)))
        elif child.tag == "div" and "exercise" in child.attrs.get("class", "").split():
            group=[Spacer(1,16), Paragraph("DESIGN EXERCISE", s["eyebrow"])]
            for el in child.children:
                if isinstance(el,Node) and el.tag=="h2": group.append(Paragraph(markup(el),s["exercise"]))
                elif isinstance(el,Node) and el.tag=="p": group.append(Paragraph(markup(el),s["body_small"]))
            group.append(Paragraph('<link href="https://mindofagents.com/design/" color="#287d76">Try the design exercise online</link>',s["body_small"]))
            story.append(KeepTogether(group))
    aside=root.find("aside","side-note")
    if aside:
        story.extend([Spacer(1,16),Paragraph("READING NOTES",s["eyebrow"])])
        for p in aside.children:
            if isinstance(p,Node) and p.tag=="p": story.append(Paragraph(markup(p),s["note"]))
    return story


def anatomy_story(s):
    story=[PageBreak(),Spacer(1,9),Paragraph("APPENDIX",s["eyebrow"]),Label("Anatomy of a Mind",s["section"],"anatomy"),
        Paragraph("A print map of twelve components of an agentic mind. The body is a metaphor for design, not a claim that an AI system is conscious.",s["body"]),
        Spacer(1,12),AnatomyFigure(),Spacer(1,8),Paragraph('Explore the <link href="https://mindofagents.com/anatomy/" color="#287d76">interactive Anatomy online</link>.',s["caption"])]
    story.extend([PageBreak(),Paragraph("TWELVE DESIGN QUESTIONS",s["eyebrow"])])
    for i,(name,desc,q) in enumerate(ANATOMY,1):
        story.append(KeepTogether([Paragraph(f"<font color='#bd5243'>{i:02d}</font>  {escape(name)}",s["exercise"]),
            Paragraph(escape(desc)+" <i>"+escape(q)+"</i>",s["body_small"])]))
    story.extend([Spacer(1,12),Paragraph("The reactive loop",s["h2"]),
        Paragraph("Notice / Understand / Imagine / Decide / Act / Learn. Each cycle can inform the next; members, other minds, and the environment remain connected.",s["body"])])
    return story


def make_story(repo, preface, s, toc=None, index=None):
    current=date.today().strftime("%B %Y")
    story=[Spacer(1,1.16*inch),Paragraph("MIND<br/>OF AGENTS",s["cover_title"]),Spacer(1,13),
           Paragraph('<font color="#63cfb7">A field guide to the philosophy and design of agentic minds</font>',
                     ParagraphStyle("cover_sub",parent=s["body"],fontName="Georgia",fontSize=13,leading=19,textColor=MINT)),
           Spacer(1,0.72*inch),Paragraph('<font color="#f6f3eb">Amit Rathore</font>',
                     ParagraphStyle("cover_author",parent=s["h2"],fontSize=15,textColor=PAPER)),
           NextPageTemplate("body"),PageBreak(),
           Spacer(1,27),Paragraph("Mind of Agents",s["section"]),
           Paragraph("An open field guide to the philosophy and design of agentic minds.",s["body"]),
           Spacer(1,23),Paragraph(f"Current edition · {current}<br/>Chapters 1–{len(CHAPTERS)} of a living book",s["body"]),
           Spacer(1,18),Paragraph("© 2026 Amit Rathore. All rights reserved.",s["body_small"]),
           Paragraph('Published at <link href="https://mindofagents.com/" color="#287d76">mindofagents.com</link>. <link href="https://opentangle.ai/" color="#287d76">Opentangle</link> is one implementation of these ideas; other builders are welcome to use and challenge the design.',s["body_small"]),
           Paragraph('Author: <link href="https://amitrathore.com/" color="#287d76">amitrathore.com</link> · Community: <link href="https://www.agentsofmind.com/" color="#287d76">Agents of Mind</link>',s["body_small"]),
           PageBreak(),Paragraph("CONTENTS",s["eyebrow"]),Label("Table of Contents",s["section"],"contents")]
    toc_items=[("Preface","preface")]+[(f"{i:02d}  {title}",f"chapter-{i}") for i,(_,title) in enumerate(CHAPTERS,1)]+[("Appendix  Anatomy of a Mind","anatomy"),("Subject Index","index"),("About the Author","about")]
    for label,key in toc_items:
        page=(toc or {}).get(key,"—")
        row=Table([[Paragraph(f'<link href="#{key}" color="#101629">{escape(label)}</link>',s["toc"]),Paragraph(str(page),s["toc"])]],colWidths=[3.95*inch,.43*inch])
        row.setStyle(TableStyle([("VALIGN",(0,0),(-1,-1),"TOP"),("LINEBELOW",(0,0),(-1,-1),0.4,LIGHT),("TOPPADDING",(0,0),(-1,-1),9),("BOTTOMPADDING",(0,0),(-1,-1),8),("LEFTPADDING",(0,0),(-1,-1),0),("RIGHTPADDING",(0,0),(-1,-1),0)]))
        story.append(row)
    story += [PageBreak(),Paragraph("A NOTE FROM THE AUTHOR",s["eyebrow"]),Label("Preface",s["section"],"preface")]
    body=preface.read_text(encoding="utf-8").strip().split("\n\n")
    for p in body[1:-1]:
        preface_markup = escape(p).replace(
            "Opentangle", '<link href="https://opentangle.ai/" color="#287d76">Opentangle</link>'
        )
        story.append(Label(preface_markup,s["body"],index_text=p))
    story += [Spacer(1,10),Paragraph("Amit Rathore",s["body"])]
    for num,(slug,title) in enumerate(CHAPTERS,1):
        root=parse_html(repo/"docs"/"read"/slug/"index.html")
        story.extend(chapter_story(root,num,title,s))
    story.extend(anatomy_story(s))
    story.extend([PageBreak(),Paragraph("REFERENCE",s["eyebrow"]),Label("Subject Index",s["section"],"index"),
                  Paragraph('Page references point to discussions in this edition. For the latest chapters, visit <link href="https://mindofagents.com/read/" color="#287d76">mindofagents.com/read/</link>.',s["body_small"])])
    for term in INDEX_TERMS:
        pages=sorted(set((index or {}).get(term,{}).values()))
        if pages:
            shown=", ".join(f'<link href="#page-{p}" color="#287d76">{p}</link>' for p in pages)
            story.append(Paragraph(f"<b>{escape(term.capitalize())}</b>  {shown}",s["index"]))
    story.extend([PageBreak(),Paragraph("THE AUTHOR",s["eyebrow"]),Label("About Amit Rathore",s["section"],"about"),
        Paragraph("Amit Rathore is an engineer, author, and entrepreneur whose work spans software, commerce, publishing, and organizational design. He wrote <i>Clojure in Action</i> and founded or helped build Runa, Quintype, and AwakeVC. Mind of Agents draws on his long interest in networks that help people create, coordinate, and participate on their own terms.",s["body"]),
        Paragraph('Continue the conversation at <link href="https://amitrathore.com/" color="#287d76">amitrathore.com</link>, or chat with <link href="https://amitavatar.com/" color="#287d76">AmitAvatar</link>. Explore <link href="https://awake.vc/" color="#287d76">AwakeVC</link>, <link href="https://opentangle.ai/" color="#287d76">Opentangle</link>, and the <link href="https://www.agentsofmind.com/" color="#287d76">Agents of Mind community</link>.',s["body"])])
    return story


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--repo",type=Path,default=Path(__file__).resolve().parents[1])
    ap.add_argument("--preface",type=Path,default=None)
    ap.add_argument("--output",type=Path,default=None)
    args=ap.parse_args()
    repo=args.repo.resolve()
    preface=args.preface or repo/"book"/"preface.md"
    output=args.output or repo/"docs"/"downloads"/"mind-of-agents-current-edition.pdf"
    output.parent.mkdir(parents=True,exist_ok=True)
    register_fonts(); s=styles()
    scratch=output.with_suffix(".first-pass.pdf")
    first=BookDoc(scratch); first.build(make_story(repo,preface,s))
    final=BookDoc(output); final.build(make_story(repo,preface,s,first.locations,first.index_locations))
    scratch.unlink()
    print(f"Built {output} ({len(CHAPTERS)} published chapters, {len(final.index_locations)} indexed terms)")


if __name__=="__main__": main()
