// Visibility only: the entry retains its read visit, attention and acknowledgement gates.
// Update with current mounted rows and canonical DTO IDs; destroy on view/visit replacement.
// Existing scroll/ResizeObserver callbacks call evaluate(); reserves read cached inset heights.
export function watchVisibleRows(root, {onChange, reserve = () => 0, reserveTop = () => 0, allowed = () => true}) {
  const document = root.ownerDocument, window = document.defaultView;
  let alive = true, epoch = 0, frame;
  let rows = new Map(), reported = new Set();
  const members = new Set();
  const publish = ids => {
    if (ids.size === reported.size && [...ids].every(id => reported.has(id))) return;
    reported = ids;
    onChange(new Set(ids));
  };
  const permitted = () => root.isConnected !== false && document.visibilityState === 'visible' && document.hasFocus() && allowed();
  const cancel = () => {
    ++epoch;
    if (frame !== undefined) window.cancelAnimationFrame(frame);
    frame = undefined;
  };
  const evaluate = () => {
    if (!alive) return;
    if (!permitted()) { cancel(); publish(new Set()); return; }
    if (frame !== undefined) return;
    const current = epoch;
    frame = window.requestAnimationFrame(() => {
      if (!alive || current !== epoch) return;
      frame = undefined;
      if (!permitted() || !members.size) { publish(new Set()); return; }
      const viewport = root.getBoundingClientRect();
      const top = Math.min(viewport.bottom, viewport.top + Math.max(0, reserveTop()));
      const bottom = Math.max(top, viewport.bottom - Math.max(0, reserve()));
      const height = bottom - top, ids = new Set();
      if (height > 0 && viewport.width > 0) for (const row of members) {
        const id = rows.get(row);
        if (!id || row.dataset.mid !== id || !root.contains(row)) continue;
        const r = row.getBoundingClientRect();
        const width = Math.min(r.right, viewport.right) - Math.max(r.left, viewport.left);
        const visible = Math.min(r.bottom, bottom) - Math.max(r.top, top);
        if (r.height > 0 && width > 0 && visible > 0 && visible >= Math.min(r.height / 2, height / 2)) ids.add(id);
      }
      publish(ids);
    });
  };
  const observer = new window.IntersectionObserver(entries => {
    if (!alive) return;
    for (const entry of entries) {
      const id = rows.get(entry.target);
      if (id && entry.target.dataset.mid === id && entry.isIntersecting && entry.intersectionRect.width > 0 && entry.intersectionRect.height > 0) members.add(entry.target);
      else members.delete(entry.target);
    }
    evaluate();
  }, {root, threshold: 0});
  const update = (nodes, canonicalIDs) => {
    if (!alive) return;
    const ids = new Set(canonicalIDs), next = new Map();
    for (const row of nodes) if (ids.has(row.dataset.mid) && root.contains(row)) next.set(row, row.dataset.mid);
    for (const [row, id] of rows) if (next.get(row) !== id) { observer.unobserve(row); members.delete(row); }
    for (const [row, id] of next) if (rows.get(row) !== id) observer.observe(row);
    rows = next;
    evaluate();
  };
  window.addEventListener('focus', evaluate);
  window.addEventListener('blur', evaluate);
  document.addEventListener('visibilitychange', evaluate);
  const destroy = () => {
    if (!alive) return;
    alive = false; cancel(); observer.disconnect(); rows.clear(); members.clear(); publish(new Set());
    window.removeEventListener('focus', evaluate);
    window.removeEventListener('blur', evaluate);
    document.removeEventListener('visibilitychange', evaluate);
  };
  return {update, evaluate, destroy};
}

// ---- list column (shared with the visibility helpers above: one layout module per package, within the 32-file limit)
// The desktop list column (MEL-822/824), the standalone counterpart of
// AgentNet's Comic list-panel: pressing the active list rail item hides the
// column and pressing it again brings it back; a separator on its edge
// resizes it by mouse and keyboard. The column stays mounted while hidden
// (inert, aria-hidden, held at its width), so its scroll, search and the open
// conversation beside it are untouched. Width and hidden state belong to this
// browser only (localStorage under the skin's own key, never the Host API).
// Phones (narrow) keep their layout: nothing here applies below the
// breakpoint.
//
// The skin's CSS owns the track: it reads --list-width (unset = the skin's
// own default) and [data-list-hidden] on the grid, and [data-hidden] on the
// column. This module only measures, clamps and stores.
export const LIST = Object.freeze({ min: 240, max: 480, conversation: 440, step: 16, bigStep: 48 });

const px = (v) => parseFloat(v) || 0;

export function listPanel({ grid, side, toggles, reveals = [], key, storage, narrow = "(max-width: 760px)", signal, id = "list-panel" }) {
  const view = grid.ownerDocument.defaultView;
  const mq = view.matchMedia(narrow);
  const saved = (() => { try { const v = JSON.parse(storage().getItem(key) || "{}"); return { width: Number.isFinite(v.width) ? v.width : null, hidden: v.hidden === true }; } catch { return { width: null, hidden: false }; } })();
  let width = saved.width === null ? null : Math.round(Math.min(LIST.max, Math.max(LIST.min, saved.width)));
  let hidden = saved.hidden;
  const save = () => { try { storage().setItem(key, JSON.stringify(width === null ? { hidden } : { width, hidden })); } catch { /* this browser only */ } };

  side.id ||= id;
  side.dataset.part = "list-panel";
  const sep = grid.ownerDocument.createElement("div");
  for (const [k, v] of Object.entries({ role: "separator", "aria-orientation": "vertical", "aria-label": "Resize the list", "aria-controls": side.id, tabindex: "0", "data-part": "list-resize", title: "Drag or use the arrow keys to resize. Double-click to reset." })) sep.setAttribute(k, v);
  side.append(sep);

  // room: the widest the column may be here, leaving the conversation its share.
  const room = () => {
    const cs = view.getComputedStyle(grid);
    const inner = grid.clientWidth - px(cs.paddingLeft) - px(cs.paddingRight) - px(cs.columnGap);
    return Math.round(Math.max(LIST.min, Math.min(LIST.max, inner - LIST.conversation)));
  };
  const clamp = (w) => Math.round(Math.min(room(), Math.max(LIST.min, w)));
  const shown = () => Math.round(side.getBoundingClientRect().width);
  const live = (w) => { if (w === null) grid.style.removeProperty("--list-width"); else grid.style.setProperty("--list-width", w + "px"); };
  const aria = () => {
    if (mq.matches || hidden) return;
    sep.setAttribute("aria-valuemin", LIST.min); sep.setAttribute("aria-valuemax", room()); sep.setAttribute("aria-valuenow", shown());
  };
  const sync = () => {
    const desktop = !mq.matches, off = desktop && hidden;
    if (off && !side.hasAttribute("data-hidden")) side.style.setProperty("--list-held", shown() + "px");
    side.toggleAttribute("data-hidden", off);
    grid.toggleAttribute("data-list-hidden", off);
    side.inert = off;
    if (off) side.setAttribute("aria-hidden", "true"); else side.removeAttribute("aria-hidden");
    for (const t of toggles) {
      if (desktop && t.getAttribute("aria-current") === "page") {
        t.setAttribute("aria-expanded", String(!hidden)); t.setAttribute("aria-controls", side.id);
        t.title = hidden ? "Show the list" : "Hide the list";
      } else { t.removeAttribute("aria-expanded"); t.removeAttribute("aria-controls"); t.removeAttribute("title"); }
    }
    aria();
  };
  const setHidden = (h) => { if (h === hidden) return; hidden = h; save(); sync(); };
  const commit = (w) => { width = w; live(w); save(); aria(); };

  // Capture on the rail runs before the items' own handlers: the active list
  // item only hides/shows (its section, search and scroll stay as they are);
  // any other item, and Activity, shows a hidden list and then does its job.
  const opts = { capture: true, signal };
  const rails = new Set([...toggles, ...reveals].map((b) => b.parentElement.closest("nav") || b.parentElement));
  for (const rail of rails) rail.addEventListener("click", (e) => {
    if (mq.matches) return;
    const item = e.target.closest?.("button");
    if (!item) return;
    if (toggles.includes(item)) {
      if (item.getAttribute("aria-current") === "page") { e.stopPropagation(); setHidden(!hidden); return; }
      setHidden(false);
    } else if (reveals.includes(item) && hidden) {
      setHidden(false);
      if (item.getAttribute("aria-expanded") === "true") e.stopPropagation(); // already open: only show it
    }
  }, opts);

  // Mouse: the grid follows the pointer through the CSS variable; the width
  // is stored once, on release.
  let drag = null;
  sep.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault(); sep.focus();
    sep.setPointerCapture(e.pointerId);
    drag = { x: e.clientX, w: shown(), now: shown() };
    grid.toggleAttribute("data-list-resizing", true);
  }, { signal });
  sep.addEventListener("pointermove", (e) => { if (!drag) return; drag.now = clamp(drag.w + e.clientX - drag.x); live(drag.now); sep.setAttribute("aria-valuenow", drag.now); }, { signal });
  const up = () => { const d = drag; drag = null; grid.removeAttribute("data-list-resizing"); if (d && d.now !== d.w) commit(d.now); };
  for (const kind of ["pointerup", "pointercancel", "lostpointercapture"]) sep.addEventListener(kind, up, { signal });
  sep.addEventListener("dblclick", () => commit(null), { signal });
  sep.addEventListener("keydown", (e) => {
    const step = e.shiftKey ? LIST.bigStep : LIST.step, w = shown();
    const next = e.key === "ArrowLeft" ? w - step : e.key === "ArrowRight" ? w + step : e.key === "Home" ? LIST.min : e.key === "End" ? room() : null;
    if (next === null) return;
    e.preventDefault();
    commit(clamp(next));
  }, { signal });

  const observer = new view.ResizeObserver(() => aria());
  observer.observe(grid);
  const current = new view.MutationObserver(sync);
  for (const t of toggles) current.observe(t, { attributes: true, attributeFilter: ["aria-current"] });
  mq.addEventListener("change", sync, { signal });
  signal?.addEventListener("abort", () => { observer.disconnect(); current.disconnect(); });
  live(width);
  sync();
  return {
    // reveal: show a hidden list before something inside it takes focus.
    reveal() { if (!mq.matches) setHidden(false); },
    get hidden() { return !mq.matches && hidden; },
  };
}
