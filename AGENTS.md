# AGENTS.md: creating a skin here

You are making an AgentNet skin in this repository. A skin runs with the page’s full trust: treat every line as security-relevant.

## Choose

- Theme or presentation change → **overlay skin** (default): `npm run new-skin -- <id> "Name"`. Edit `skins/<id>/overlay/` only. Keep `brand.tsx` id, `storage` and `themeKey` on the skin id. Delete slots you leave unchanged.
- Different interaction → **standalone skin**: `npm run new-skin -- <id> "Name" --standalone`. Edit `skins/<id>/src/` and declare every file in `skin.json`.
- Never create or edit another engineer’s skin, `published/` by hand, or anything under `.cache/` or `dist/`.

## Read first

- The pinned contract: `.cache/upstream/docs/UI_SKINS.md` and `docs/HOST_API_ROUTES.md` (commit in `upstream.json`; `AGENTNET_SOURCE=/path/to/agentnet` archives it).
- Overlays: `.cache/upstream/internal/ui/web/src/skin/README.md` (slots, what each must keep, `data-part` names).
- Here: [docs/CREATING.md](docs/CREATING.md), [docs/CONFORMANCE.md](docs/CONFORMANCE.md), [docs/COMPATIBILITY.md](docs/COMPATIBILITY.md), [CONTRIBUTING.md](CONTRIBUTING.md).

## Commands

```sh
npm ci
npm run build                  # dist/<id>/ (overlays: the pinned AgentNet's Comic build)
npm run check                  # lint, manifests, reproducibility, scaffolds, published/ hashes
npm test                       # AgentNet contract check, gallery acceptance, browser journeys
npm run previews -- <id>       # real previews with an invented company
npm run publish                # published/ and catalog.json, after gallery.json is filled
```

Set `AGENTNET_CHROMIUM`, `AGENTNET_GO` and a short `TMPDIR` when the defaults do not fit. Keep full test logs and report the suites that ran for each skin.

## Never

- Fetch `/api` or `/events`, read `window.agentnet*` or other page globals, query or write `document` outside the root, poll, `eval`, use inline styles or `innerHTML` with message text.
- Load anything remote (CDN code, fonts, images); every asset ships in the package.
- Use real people’s names, photos or identities, trademarks or franchise logos in code, previews or fixtures.
- Weaken a test or count a skipped suite as a pass; report what failed.
- Commit logs, keys, screenshots outside `skins/<id>/previews/`, `dist/` or `.cache/`; push, tag or create releases (the owner releases).
