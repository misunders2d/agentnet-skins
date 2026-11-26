import { hasSpoilerPlaceholder, hiddenText, maskSpoilers, markdownInlineTokens, markdownText, markdownTokens, portableLink, shortLinkLabel, spoilerFallback } from "./link-text.mjs";

const safeHref = href => portableLink(href) || /^(https?:\/\/|mailto:)/i.test(href);
const decode = text => markdownText(spoilerFallback(text));

// Text and safe elements only. Compact Zoom bubbles are a single button;
// links and spoilers become interactive only inside the opened message.
export function messageMarkdown(text, { el, mention, compact = false }) {
  if (!text) return [];
  // Most timeline entries are plain messages and need no Markdown token tree.
  if (!compact && !/[\\`*_~[\]<>!&#\n\r|^:@\t]|www\.|^ {4}|^ {0,3}(?:[-+=]|\d{1,9}[.)]\s)/i.test(text)) return [el("p", {}, text)];
  function spoiler(text) {
    const setOpen = open => {
      control.setAttribute("aria-pressed", String(open));
      control.replaceChildren(...(open ? inline(markdownInlineTokens(text)) : [hiddenText]));
    };
    const toggle = () => setOpen(control.getAttribute("aria-pressed") !== "true");
    const control = el("span", { class: "message-spoiler", role: "button", tabindex: "0", "aria-pressed": "false",
      onclick: event => {
        const link = event.target.closest("a[href]");
        if (link && control.contains(link)) return;
        event.stopPropagation();
        toggle();
      },
      onkeydown: event => {
        if (event.target !== control || ![" ", "Enter"].includes(event.key)) return;
        event.preventDefault();
        event.stopPropagation();
        toggle();
      } }, hiddenText);
    control.setSpoilerOpen = setOpen;
    return control;
  }

  function inline(tokens) {
    return tokens.flatMap(t => {
      switch (t.type) {
        case "text": return t.tokens ? inline(t.tokens) : [decode(t.text)];
        case "br": return [el("br")];
        case "html": case "escape": return [spoilerFallback(t.text)];
        case "codespan": return [el("code", {}, spoilerFallback(t.text))];
        case "strong": case "em": case "del": case "underline":
          return [el(t.type === "underline" ? "u" : t.type, {}, inline(t.tokens || []))];
        case "spoiler": return [compact ? hiddenText : spoiler(t.text)];
        case "image": case "link": {
          const image = t.type === "image";
          const children = image || t.autolink ? [spoilerFallback(t.text || t.href)] : inline(t.tokens || []);
          const title = t.title || "";
          if (hasSpoilerPlaceholder(t.href) || hasSpoilerPlaceholder(title) ||
              maskSpoilers(t.href) !== t.href || maskSpoilers(title) !== title) return children;
          if (!image && !hasSpoilerPlaceholder(t.text) && /^agentnet:(person|guest|agent|collective)\//.test(t.href)) return mention(t.raw);
          if (compact || !safeHref(t.href)) return children;
          const label = hasSpoilerPlaceholder(t.text) ? t.text : shortLinkLabel(t.text, t.href);
          const short = label !== t.text;
          return [el("a", { href: t.href, target: "_blank", rel: "noopener noreferrer",
            title: short ? t.href : t.title, "aria-label": short ? t.href : undefined }, short ? label : children)];
        }
        default: return t.tokens ? inline(t.tokens) : [spoilerFallback(t.raw || "")];
      }
    });
  }

  function blocks(tokens) {
    return tokens.flatMap(t => {
      if (t.type === "space" || t.type === "def") return [];
      if (t.type === "hr") return [el(compact ? "br" : "hr")];
      if (t.type === "code") {
        const code = el("code", {}, spoilerFallback(t.text));
        return compact ? [code, el("br")] : [el("pre", {}, code)];
      }
      if (t.type === "list") {
        if (compact) return t.items.flatMap((it,i) => [el("span", {}, t.ordered ? String(Number(t.start || 1) + i) + ". " : "• ", blocks(it.tokens)), el("br")]);
        return [el(t.ordered ? "ol" : "ul", t.ordered ? { start: t.start } : {}, t.items.map(it =>
          el("li", {}, it.task ? (it.checked ? "☑ " : "☐ ") : null, blocks(it.tokens))))];
      }
      if (t.type === "table") {
        if (compact) return [t.header, ...t.rows].flatMap(row =>
          [el("span", {}, row.flatMap((c,i) => [i ? " · " : "", inline(c.tokens)])), el("br")]);
        const row = (cells, tag) => el("tr", {}, cells.map(c => el(tag, {}, inline(c.tokens))));
        return [el("div", { class: "markdown-table" },
          el("table", {}, el("thead", {}, row(t.header, "th")), el("tbody", {}, t.rows.map(cells => row(cells, "td")))))];
      }
      const content = t.type === "html" ? [spoilerFallback(t.text)]
        : t.type === "blockquote" ? blocks(t.tokens || [])
        : t.tokens ? inline(t.tokens) : [decode(t.text || t.raw || "")];
      const children = t.type === "heading" ? el("strong", {}, content) : content;
      return compact ? [el("span", {}, children), el("br")]
        : [el(t.type === "blockquote" ? "blockquote" : "p", {}, children)];
    });
  }

  return blocks(markdownTokens(text, compact ? "mask" : "reveal"));
}


// A live refresh creates new message nodes. Carry a reveal only to the same
// message and exact displayed revision inside the caller's current view.
const spoilerSelector = '.message-spoiler';
export function captureMessageSpoilers(view, active) {
  const open = new Map();
  for (const control of view.querySelectorAll(spoilerSelector + '[aria-pressed="true"]')) {
    const body = control.closest('.body-markdown');
    const source = body?.spoilerSource;
    if (!source) continue;
    if (!open.has(source.id)) open.set(source.id, { source, indexes: [], focused: -1 });
    const saved = open.get(source.id);
    const index = [...body.querySelectorAll(spoilerSelector)].indexOf(control);
    saved.indexes.push(index);
    if (control === active) saved.focused = index;
  }
  return open;
}

export function restoreMessageSpoilers(view, open) {
  if (!open.size) return false;
  let focused = false;
  for (const body of view.querySelectorAll('.body-markdown')) {
    const source = body.spoilerSource;
    const saved = source && open.get(source.id);
    if (!saved || saved.source.dir !== source.dir || saved.source.from !== source.from ||
        saved.source.revision !== source.revision || saved.source.text !== source.text) continue;
    const controls = body.querySelectorAll(spoilerSelector);
    for (const index of saved.indexes) {
      const control = controls[index];
      if (!control?.setSpoilerOpen) continue;
      control.setSpoilerOpen(true);
      if (index === saved.focused) {
        control.focus({ preventScroll: true });
        focused = true;
      }
    }
  }
  return focused;
}
