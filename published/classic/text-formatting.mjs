import { fieldSelection, formats, formatText } from "./link-text.mjs";

const validLink = value => /^(https?:\/\/|mailto:)[^<>\s]+$/i.test(value);

// The textarea stays native. Only a selected range gets a custom menu;
// touch users keep their native selection handles and get a separate button.
export function formattingField(field, { el, root, signal, refs = () => [], write, scope = () => field, floating = false, browser = false }) {
  const view = field.ownerDocument.defaultView;
  const touch = view.matchMedia("(pointer: coarse)");
  const mac = /Mac|iPhone|iPad/.test(view.navigator.platform || view.navigator.userAgent);
  const trigger = el("button", { type: "button", class: "btn format-trigger", "aria-haspopup": "menu", "aria-expanded": "false", hidden: true }, "Formatting");
  // Some Chromium builds treat the initiating right-button release as an
  // outside click on an auto popover. Own dismissal inside the skin instead.
  const menu = el("div", { class: "format-menu", popover: "manual", role: "menu", "aria-label": "Text formatting" });
  const wrap = el("div", { class: "format-field" + (floating ? " format-floating" : "") }, field, trigger, menu);
  const choices = el("div", { role: "group", "aria-label": "Styles", hidden: true });
  const submenu = el("button", { type: "button", role: "menuitem", "aria-haspopup": "menu", "aria-expanded": "false" }, "Formatting ›");
  menu.append(submenu, choices);
  let opening, link;

  const snapshot = () => {
    const selection = fieldSelection(field);
    if (!selection || field.disabled || !field.isConnected) return null;
    const key = scope();
    return key == null ? null : { selection, value: field.value, scope: key };
  };
  const stillCurrent = saved => saved && field.isConnected && !field.disabled && saved.scope === scope() && saved.value === field.value;
  const refresh = () => { trigger.hidden = !fieldSelection(field) || field.disabled; };
  const focusField = () => field.focus({ preventScroll: true });

  function applyFormat(result) {
    focusField();
    field.value = result.value;
    const { from, to, direction } = result.selection;
    field.setSelectionRange(from, to, direction);
    if (write) write(result.value, result.refs);
    else field.dispatchEvent(new Event("input", { bubbles: true }));
    refresh();
  }

  function openLink(saved) {
    const input = el("input", { type: "text", inputmode: "url", autocomplete: "off", "aria-label": "Link URL" });
    const apply = el("button", { type: "button", class: "btn primary", disabled: true }, "Apply link");
    const cancel = el("button", { type: "button", class: "btn" }, "Cancel");
    link = el("dialog", { class: "format-link", "aria-label": "Add link" }, el("h3", {}, "Add link"),
      input, el("div", { class: "edit-actions" }, cancel, apply));
    const dialog = link;
    function submit() {
      if (!validLink(input.value) || !stillCurrent(saved)) return;
      const result = formatText(saved.value, refs(), saved.selection, "link", input.value);
      if (!result) return;
      dialog.close();
      applyFormat(result);
    }
    apply.addEventListener("click", submit);
    cancel.addEventListener("click", () => dialog.close());
    input.addEventListener("input", () => { apply.disabled = !validLink(input.value); });
    dialog.addEventListener("keydown", event => {
      event.stopPropagation();
      if (event.target === input && event.key === "Enter" && !event.isComposing && event.keyCode !== 229) {
        event.preventDefault();
        submit();
      }
    });
    dialog.addEventListener("close", () => {
      dialog.remove();
      if (link === dialog) link = null;
      if (!stillCurrent(saved)) return;
      focusField();
      const { from, to, direction } = saved.selection;
      field.setSelectionRange(from, to, direction);
    });
    wrap.append(dialog);
    dialog.showModal();
    input.focus();
  }

  function closeMenu() {
    root.removeEventListener("pointerdown", closeOnOutside, true);
    if (menu.matches(":popover-open")) menu.hidePopover();
    trigger.setAttribute("aria-expanded", "false");
  }
  function closeOnOutside(event) {
    if (!wrap.contains(event.target) || !menu.matches(":popover-open")) closeMenu();
  }

  function run(style, saved) {
    closeMenu();
    if (!stillCurrent(saved)) return;
    focusField();
    if (style === "link") { openLink(saved); return; }
    const result = formatText(saved.value, refs(), saved.selection, style);
    if (result) applyFormat(result);
  }

  for (const format of formats) {
    const primary = (mac ? "⌘" : "Ctrl+") + format.shortcut;
    const alternate = format.browserShortcut && "Ctrl+Alt+" + format.browserShortcut;
    choices.append(el("button", { type: "button", role: "menuitem", title: alternate && primary + " / " + alternate,
      onclick: () => run(format.id, opening) }, format.label,
      el("small", { "aria-hidden": "true" }, browser && alternate || primary)));
  }

  function open(direct) {
    const saved = snapshot();
    if (!saved || link?.open) return;
    opening = saved;
    submenu.hidden = direct;
    choices.hidden = !direct;
    submenu.setAttribute("aria-expanded", "false");
    if (!menu.matches(":popover-open")) menu.showPopover();
    root.addEventListener("pointerdown", closeOnOutside, { capture: true, signal });
    trigger.setAttribute("aria-expanded", "true");
    (direct ? choices.firstElementChild : submenu).focus({ preventScroll: true });
  }
  function showChoices() {
    choices.hidden = false;
    submenu.hidden = true;
    submenu.setAttribute("aria-expanded", "true");
    choices.firstElementChild.focus({ preventScroll: true });
  }
  submenu.addEventListener("click", showChoices);
  trigger.addEventListener("mousedown", event => event.preventDefault());
  trigger.addEventListener("click", () => open(true));
  field.addEventListener("contextmenu", event => {
    if (event.shiftKey || !snapshot()) return;
    event.preventDefault();
    event.stopPropagation();
    open(touch.matches);
  });
  menu.addEventListener("toggle", event => {
    if (event.newState === "closed" && !menu.matches(":popover-open")) closeMenu();
  });
  menu.addEventListener("keydown", event => {
    const { key, target } = event;
    const buttons = choices.hidden ? [submenu] : [...choices.children];
    const index = buttons.indexOf(target);
    if (index < 0) return;
    if (key === "Tab") { closeMenu(); focusField(); return; }
    if (key === "Escape" || key === "ArrowLeft" && !choices.hidden && !touch.matches) {
      event.preventDefault();
      event.stopPropagation();
      if (key === "ArrowLeft") {
        choices.hidden = true;
        submenu.hidden = false;
        submenu.setAttribute("aria-expanded", "false");
        submenu.focus();
      } else { closeMenu(); focusField(); }
    } else if (key === "ArrowRight" && target === submenu) {
      event.preventDefault();
      showChoices();
    } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(key)) {
      event.preventDefault();
      const next = key === "Home" ? 0 : key === "End" ? buttons.length - 1
        : (index + (key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next].focus();
    }
  });
  for (const event of ["select", "selectionchange", "input", "focus"]) field.addEventListener(event, refresh);
  field.addEventListener("keydown", event => {
    if (!(event.ctrlKey || event.metaKey) || event.isComposing || event.keyCode === 229) return;
    const saved = snapshot();
    if (!saved) return;
    const format = formats.find(action => action.key === event.code && (event.altKey
      ? action.browserShortcut && event.ctrlKey && !event.shiftKey && !event.getModifierState("AltGraph")
      : action.shortcut.startsWith("Shift+") === event.shiftKey));
    if (!format) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    run(format.id, saved);
  });
  return wrap;
}

// A same-view refresh can rebuild the bubble while an edit is still local.
// Keep the actual editor and its selection only for the same message revision.
export function captureMessageEdits(container) {
  return Array.from(container.querySelectorAll(".edit-box"), box => ({
    box, menu: box.querySelector(".format-menu:popover-open"),
  }));
}

export function restoreMessageEdits(edits, container, focused) {
  let restore;
  for (const { box, menu } of edits) {
    const row = container.querySelector(box.messageSelector);
    const body = row?.querySelector(".body");
    const next = body?.editSource, previous = box.originalBody.editSource;
    if (!next || !previous || next.dir !== previous.dir || next.revision !== previous.revision || next.text !== previous.text) continue;
    box.querySelector(".format-link[open]")?.close();
    box.originalBody = body;
    body.replaceWith(box);
    // Disconnecting a row closes its popover in the browser's top layer.
    if (menu) menu.showPopover();
    if (box.contains(focused)) restore = focused.closest("dialog") ? box.querySelector("textarea") : focused;
  }
  restore?.focus({ preventScroll: true });
  return !!restore;
}
