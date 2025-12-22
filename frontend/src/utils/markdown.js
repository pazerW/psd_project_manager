import MarkdownIt from "markdown-it";
import texmath from "markdown-it-texmath";
import katex from "katex";
import taskLists from "markdown-it-task-lists";
import anchor from "markdown-it-anchor";
import container from "markdown-it-container";
import attrs from "markdown-it-attrs";
import footnote from "markdown-it-footnote";
import deflist from "markdown-it-deflist";
import hljs from "markdown-it-highlightjs";
import wikilinks from "markdown-it-wikilinks";

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
});

// 数学渲染（KaTeX via texmath）
md.use(texmath, {
  engine: katex,
  delimiters: "dollars",
  katexOptions: { macros: { "\\RR": "\\mathbb{R}" } },
});
md.use(taskLists, { enabled: true });
md.use(anchor, { permalink: anchor.permalink.ariaHidden({}) });
md.use(container, "callout");
md.use(attrs);
md.use(footnote);
md.use(deflist);
md.use(hljs);

// 简单的 wikilinks 支持：[[Note]] -> /note/Note（可根据需要自定义）
md.use(wikilinks, {
  uriSuffix: "",
  uriPrefix: "/note/",
  postProcessPageName: (x) => x.replace(/\s+/g, "-"),
});

export function renderMarkdown(src) {
  if (!src) return "";
  try {
    return md.render(src);
  } catch (e) {
    console.error("markdown render error", e);
    return "";
  }
}

export default md;
