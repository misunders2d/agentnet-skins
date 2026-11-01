// Big received files wait for a tap, as on Telegram (AgentNet FileView.fetch,
// docs/UI_SKINS.md host.file: videos over 10 MiB, other files over 3 MiB,
// cleared copies). The download runs in this device's AgentNet whatever the
// page does; the page follows it one held answer at a time, never a timer.
// One state per file and host, shared by every control drawn for it, outlives
// redraws; once the file is here the next view no longer says fetch.
export const waitsForTap = file => file?.fetch === 'wait' || file?.fetch === 'fetching';

const scopes = new WeakMap();
const scopeOf = host => { let s = scopes.get(host); if (!s) scopes.set(host, s = {downloads: new Map(), views: new Map(), following: new Set()}); return s; };
const route = (ref, what, after) => '/api/files/' + encodeURIComponent(ref.id) + '/' + ref.index + '/' + what + '?dir=' + encodeURIComponent(ref.dir) + (after === undefined ? '' : '&after=' + after);
const message = error => String(error?.message || error || 'Download failed.');

function set(s, key, d) {
  s.downloads.set(key, d);
  for (const paint of [...(s.views.get(key) || [])]) paint(d);
}

async function follow(s, key, ref, api, p) {
  if (s.following.has(key)) return;
  s.following.add(key);
  try {
    for (;;) {
      if (p.done) return set(s, key, {phase: 'here', have: p.total, total: p.total});
      if (p.gone) return set(s, key, {phase: 'gone', have: 0, total: p.total, error: p.error});
      if (p.error) return set(s, key, {phase: 'failed', have: p.have, total: p.total, error: p.error});
      if (!p.fetching) return set(s, key, {phase: 'wait', have: p.have, total: p.total}); // nothing runs now (a restart): offer it again
      set(s, key, {phase: 'fetching', have: p.have, total: p.total});
      p = await api(route(ref, 'progress', p.have));
    }
  } catch (error) {
    const d = s.downloads.get(key);
    set(s, key, {phase: 'failed', have: d?.have || 0, total: d?.total || ref.size, error: message(error)});
  } finally { s.following.delete(key); }
}

// mountFileFetch draws a waiting file's Download control into root: the
// progress shows at once on a tap, before the request leaves.
export function mountFileFetch({root, file, ref, host, api, size}) {
  const document = root.ownerDocument, s = scopeOf(host), key = ref.dir + ':' + ref.id + ':' + ref.index;
  const name = String(file.name || 'File'), total = Number.isSafeInteger(file.size) && file.size >= 0 ? file.size : 0;
  const make = (tag, text = '') => { const node = document.createElement(tag); node.textContent = text; return node; };
  const box = make('span'); box.className = 'an-file-fetch';
  let seen = false;
  const start = () => {
    const d = s.downloads.get(key);
    if (d?.phase === 'fetching' && s.following.has(key)) return;
    set(s, key, {phase: 'fetching', have: d?.phase === 'failed' ? d.have : 0, total: d?.total || total});
    Promise.resolve().then(() => api(route(ref, 'fetch'), {})).then(p => follow(s, key, {...ref, size: total}, api, p))
      .catch(error => set(s, key, {phase: 'failed', have: 0, total, error: message(error)}));
  };
  const paint = d => {
    if (!box.isConnected) { if (seen) views.delete(paint); } else seen = true;
    box.replaceChildren();
    box.dataset.download = d.phase;
    const pct = d.total > 0 ? Math.min(100, Math.floor(d.have / d.total * 100)) : 0;
    if (d.phase === 'fetching') {
      const bar = make('progress'); bar.max = 100; bar.value = pct; bar.setAttribute('aria-label', 'Downloading ' + name);
      box.append(bar, make('span', 'Downloading ' + pct + '% · ' + size(Math.round(total * pct / 100)) + ' of ' + size(total)));
    } else if (d.phase === 'failed') {
      const note = make('span', 'Couldn’t download: ' + d.error), retry = make('button', 'Retry');
      note.setAttribute('role', 'status'); retry.type = 'button'; retry.className = 'btn an-hit'; retry.setAttribute('aria-label', 'Retry download ' + name); retry.onclick = start;
      box.append(note, retry);
    } else if (d.phase === 'gone') {
      const note = make('span', 'This file is no longer on the relay.'); note.setAttribute('role', 'status'); box.append(note);
    } else if (d.phase === 'here') {
      const note = make('span', 'Downloaded.'); note.setAttribute('role', 'status'); box.append(note);
    } else {
      const button = make('button', 'Download · ' + size(total));
      button.type = 'button'; button.className = 'btn an-hit'; button.setAttribute('aria-label', 'Download ' + name + ', ' + size(total)); button.onclick = start;
      box.append(button);
    }
  };
  let views = s.views.get(key);
  if (!views) s.views.set(key, views = new Set());
  views.add(paint);
  // A view that still says fetch is newer than a finished download (a copy cleared since).
  if (s.downloads.get(key)?.phase === 'here' && !s.following.has(key)) s.downloads.delete(key);
  const known = s.downloads.get(key);
  paint(known || {phase: file.fetch === 'fetching' ? 'fetching' : 'wait', have: 0, total});
  // A download started earlier, maybe from another page: follow it again.
  if (file.fetch === 'fetching' && !known && !s.following.has(key))
    Promise.resolve().then(() => api(route(ref, 'progress', -1))).then(p => follow(s, key, {...ref, size: total}, api, p)).catch(() => {});
  root.append(box);
  return box;
}
