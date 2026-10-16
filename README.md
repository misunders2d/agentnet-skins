# AgentNet skins

Portable interfaces for [AgentNet](https://github.com/misunders2d/agentnet). Build one, share its folder, install it on a computer or relay, import it into one browser, or pick it from AgentNet’s in-app **skin gallery**. Every skin uses AgentNet’s existing encrypted conversations, topics, people, agents and permissions through **Host API v1**.

## Gallery

| Skin | Direction | Available here |
| --- | --- | --- |
| [Holonet](skins/holonet) | Star Wars-inspired spacecraft comms console: horizontal command navigation, framed transmissions, command dock, crew console and brief instrument/split-shutter transitions. Original artwork; no franchise logos or characters. | Screenshots, motion preview, source and installable build |
| [Classic](skins/classic) | AgentNet’s original interface: chat list beside the open conversation, with topics, people, agents, activity and settings. Built into AgentNet up to v0.8.24; lives here from v0.8.25. | Screenshots, source and installable build |
| [Zoom](skins/zoom) | Zoom through the workspace: everyone, one person, one conversation, one message; Esc steps back out; writing happens in a focused dialog. Built into AgentNet up to v0.8.24; lives here from v0.8.25. | Screenshots, source and installable build |
| [Pulp](skins/pulp) | An overlay skin on Comic: a 1970s paperback by day and a roadside diner by night. Chats read like a table of contents, topics open with chapter cards, requests for your OK arrive as a case, and agents wear costumes. Everything Comic does. | Screenshots, overlay source and installable build |
| [Office](skins/office) | A plain workplace messenger: white pages, thin hairlines, a dark neutral rail, the device's own font, flat messages and a bordered composer. An overlay skin on Comic: everything Comic does, without the stickers. | Screenshots, overlay source and installable build |

Each skin’s own README contains current screenshots of the real rendered skin, covering desktop/mobile and supported themes. Keep this root catalogue compact; put previews and skin-specific guidance in `skins/<id>/`. Use synthetic content with invented names, label the tested revision, and refresh previews when visible behavior changes. A gallery entry without a preview is incomplete; a preview never replaces compatibility tests. See [CONTRIBUTING.md](CONTRIBUTING.md).

From v0.8.25 AgentNet keeps only **Comic** built in. Comic is also the base of every *overlay skin* below.

## Three kinds of skin

| Kind | What you write | What you get |
| --- | --- | --- |
| **Theme-only overlay** | `overlay/brand.tsx` (identity) and `overlay/theme.css` (colours, fonts, corners, motion tokens) | Comic’s whole interface in your look |
| **Overlay skin** | Any of Comic’s slots in `overlay/`: theme, fonts, brand mark, avatars, send button, topic intro, request frame | Comic’s interface and flows with your own presentation; Comic’s fixes and features arrive on every rebuild |
| **Standalone skin** | A complete package in `src/` (Holonet, Classic, Zoom) | A different interface altogether, on the skin contract alone |

Start with an overlay unless the interaction itself must change. The slots and what each must keep are in the pinned AgentNet’s [Comic kit README](https://github.com/misunders2d/agentnet/blob/ac98b331ce11425d7595beceb53f123068ddd705/internal/ui/web/src/skin/README.md).

## Build and install

Node 22 or newer. Standalone skins build with Node alone. Overlay skins are built by the pinned AgentNet’s own Comic build (`internal/ui/web/build.sh`), which needs the pinned checkout (see Verify) and npm registry access or its cache:

```sh
npm run build                # every skins/<id>
node scripts/build.mjs zoom  # one skin
```

The complete package is **`dist/<id>/`**, with `skin.json` and only its declared assets. Its sibling `dist/<id>.SHA256SUMS` records reproducible file hashes (and an overlay’s `dist/<id>.LICENSES.txt` its bundled licenses); leave both outside the package.

- **Gallery:** in AgentNet, **Settings → Appearance → Skin gallery** lists the skins of this collection’s latest published GitHub release, verifies every byte and asks for trust before first use.
- **Browser:** use **Settings → Appearance → Skin**, or the host bar’s **Import or remove skins…**. Select every file in `dist/<id>/`, review the exact package digest, then choose **Use this skin**. Import stays in this browser and origin.
- **Computer:** copy `dist/<id>/` to `<agentnet-home>/skins/<id>/` and restart the serving daemon.
- **Relay:** copy it to `<hub-data>/skins/<id>/` and restart the serving Hub. Each browser chooses its own skin.

On Unix, package directories/files must belong to the serving user and be unwritable by group/others. The build uses owner-only modes. First use asks for trust; changed package bytes ask again. Choose `?skin=<id>` after authentication, or use the skin picker. The host’s separate bar keeps **Switch to Comic**, workspace controls and notification fallback reachable.

A skin runs with the page’s full trust: it can read chats and act as you. Shadow DOM isolates styling; it is not a sandbox. Inspect source before trusting a package.

## Create a skin

```sh
npm run new-skin -- tide "Tide"                  # overlay skin (default): skins/tide/overlay/ from the pinned Comic kit
npm run new-skin -- orbit "Orbit" --standalone   # standalone skin: Holonet's complete code in skins/orbit/src/
npm run build && npm run check
```

An overlay starts with every slot of the pinned kit; delete the ones you keep unchanged so they follow Comic on each rebuild (a theme-only skin keeps `brand.tsx` and `theme.css`). Its `skin.json` holds only `api`, `id`, `name` and `agentnet`; the build writes the complete manifest. A standalone scaffold is a **complete independent package** with all conversation, topic, agent, people, settings and file controls; it keeps Holonet’s internal selectors so the interaction journeys apply unchanged. Color and corner changes alone are theme variants.

Start with [CONTRIBUTING.md](CONTRIBUTING.md), the [creator quickstart](docs/CREATING.md), the [compatibility checklist](docs/CONFORMANCE.md) and the [version policy](docs/COMPATIBILITY.md). AI coding agents read [AGENTS.md](AGENTS.md). The authoritative contract remains AgentNet’s [UI_SKINS.md](https://github.com/misunders2d/agentnet/blob/ac98b331ce11425d7595beceb53f123068ddd705/docs/UI_SKINS.md) at the pinned revision.

## Verify

```sh
npm ci
npx playwright install --with-deps chromium
npm run build
npm run check
npm test
```

`check` covers manifests, declared assets/imports, syntax, the source lint (for an overlay: its own sources), reproducible builds, the new-skin scaffolds, negative cases and `published/` (every hash and digest recomputed). `test` adds, for every package, AgentNet’s own contract check against the pinned demo daemon, the pinned AgentNet’s gallery code reading `published/`, and headless Chromium contract/lifecycle and real production-loader journeys against a **disposable company**: no personal profile, real model, live enrollment or user messages. Tests require Linux, Go 1.26.8, Git, Bash, Python 3 and OpenSSL. They compile the exact upstream commit in `upstream.json`, AgentNet `ac98b331` at `v0.8.32`; the default checkout is ignored under `.cache/`.

Every `skins/<id>/` is built and tested, together with a temporary standalone scaffold whose original sibling source is removed before building, and a throwaway overlay built twice to prove identical bytes. Journeys run per interaction family: the Classic-family journeys for Holonet and Classic, the same checks through Zoom’s ladder and write dialog for Zoom, AgentNet’s Comic journey for overlays. The runner prints which suites ran for each skin; a skipped suite is never counted as a pass. [CI](.github/workflows/test.yml) runs the same commands. An existing Chromium can be selected with `AGENTNET_CHROMIUM=/path/to/chromium`. For offline/cached source use `AGENTNET_SOURCE=/path/to/agentnet`; only the pinned Git commit is archived, never working-tree changes. Choose an installed Go with `AGENTNET_GO=/path/to/go`.

A pinned AgentNet that still embeds a skin reserves its id (v0.8.24 and older embed Classic and Zoom): its program skips an installed package with that id. The production-loader journeys and previews then run a renamed copy (same code; only `skin.json` and the generated `manifest.mjs` differ) and say so. The current pin embeds only Comic, so every package here runs under its own id.

Synthetic homes, keys, task data and fixture URLs are deleted after verification. Screenshots and bounded results stay in a private `/tmp/agentnet-skins-*` directory and are not committed or uploaded by CI.

Passing tests prove named journeys for tested bytes; they do not certify arbitrary layouts, provider accounts or harmless code. Physical phones, mobile OS keyboards, live Google consent, real models and remote deployments remain separate checks.

## Previews

```sh
npm run previews -- zoom   # skins/zoom/previews/{desktop,mobile}-{light,dark}.png
```

The real skin on the pinned AgentNet’s production loader with a disposable fictional company (Brightwater Ceramics: invented people and messages, deleted afterwards): the skin’s own area at 1440×1000 and 390×844, light and dark, PNG. Inspect every image before committing it.

## Release to the gallery

AgentNet’s gallery reads only the **latest published GitHub release** of this repository: `published/catalog.json` and the files under `published/<id>/` at that release’s tag. Work on `main` never reaches it.

1. `npm run build` and `npm test`; review the per-skin suite summary.
2. Fill `skins/<id>/gallery.json`: `version`, a plain description of at most 400 characters, and up to six PNG/WebP previews (at most 1 MiB each) with alt text. A skin without a description or a preview is left out of the catalog.
3. `npm run publish` writes `published/<id>/` (the exact `dist/<id>` package and its previews) and `published/catalog.json`, deterministically. `npm run check` then recomputes every hash and digest.
4. Commit `published/` with the change.
5. The owner creates the GitHub release; only then does the gallery offer it. A skin’s `agentnet` field names the release it was checked against; older AgentNet releases list it as incompatible.

## Provenance

Holonet retains AgentNet v0.8.1 Classic functionality at commit `daddab38d229f695936a6d975702668b381f3135`, with an original cockpit composition, action-linked motion and contract fixes. Classic and Zoom moved here from AgentNet at commit `b9c2a6e78be1d34f38f737517a7a5b0fe53a83b6`, with only contract fixes. Details in [PROVENANCE.md](PROVENANCE.md). Code is Apache-2.0; retained QR and Markdown-lexer code keeps its original notices. See [LICENSE](LICENSE) and [NOTICE](NOTICE). Star Wars is referenced only as inspiration; this project has no affiliation with its owners.

The v0.8.27 packages show supported native approval/input requests on current
owner-human devices in Classic, Holonet, Zoom and the rebuilt Pulp overlay.
They use the host's existing bound response routes without an operator grant,
permission override or new run. Ambiguous response failures retain the exact
chosen answer for Retry; private input remains in memory only. Host authority
checks decide whether a live operation can continue. Rendered fixture tests
verify presentation and retry boundaries, not universal native tool support.

The v0.8.32 candidate is pinned to `ac98b331ce11425d7595beceb53f123068ddd705`. The full collection gate passed against this exact candidate; proposed gallery release `v2026.10.16.2` is not published. The 20 inspected previews were rendered on `3ba44749`; its production, generated and runtime source bytes are identical to this candidate.
