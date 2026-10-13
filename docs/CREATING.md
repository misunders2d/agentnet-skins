# Create and share a skin

IDs start with a lowercase letter, contain lowercase letters/digits/hyphens and have at most 48 characters. `comic` and `default` are reserved, and no skin may be named Comic (AgentNet v0.8.25 keeps only Comic built in). Classic and Zoom are collection skins now; a new skin needs a name of its own.

## Pick the kind

- **Theme-only overlay**: Comic’s whole interface in your colours, fonts, corners and motion. Two files: `overlay/brand.tsx` and `overlay/theme.css`.
- **Overlay skin**: Comic’s interface and flows with your own presentation in any of its slots (fonts, mark, avatars, send button, topic intro, request frame). Comic’s fixes and features reach it on every rebuild.
- **Standalone skin**: a different interface altogether, as a complete package of your own code (Holonet, Classic, Zoom). You own every flow and every fix.

Choose an overlay unless the interaction itself must change.

## Overlay skin

1. `npm run new-skin -- tide "Tide"` creates `skins/tide/`: `skin.json` (`{api, id, name, agentnet}` only; the build writes the complete manifest), `overlay/` with every slot of the pinned AgentNet’s Comic kit (its `brand.tsx` already names the new id, name, `storage` and `themeKey`), `gallery.json` and a README. It needs the pinned AgentNet checkout (`AGENTNET_SOURCE=/path/to/agentnet` or a clone).
2. Read the slots table in the pinned kit README (`internal/ui/web/src/skin/README.md` in the checkout under `.cache/upstream`). Change `theme.css` first: every token Comic defines keeps its name, text keeps at least 4.5:1 on its surface in both themes, movement only outside `prefers-reduced-motion: reduce`. Style the documented `data-part` elements only when tokens are not enough; never hide a control or text.
3. Delete every slot you keep unchanged so it follows Comic on each rebuild. A theme-only skin keeps `brand.tsx` and `theme.css`.
4. Fonts: `overlay/fonts/*.woff2`, licensed for redistribution, named by `overlay/document.css` (only `@font-face` rules, URLs `m/fonts/<file>.woff2`).
5. `npm run build && npm run check`. The build runs the pinned AgentNet’s `internal/ui/web/build.sh` (npm registry access or cache), then validates `dist/tide/` like any package; the source lint checks your overlay files. Rebuilding gives identical bytes.

An overlay may add its own helper modules or SVGs beside the slots and import them; it imports nothing outside AgentNet’s web source and never reaches transport, page globals or the page’s DOM itself.

## Standalone skin

1. `npm run new-skin -- orbit "Orbit" --standalone` creates `skins/orbit/` with Holonet’s complete code in `src/`, a manifest of its own, `gallery.json` and a README.
2. Create a distinct composition, interaction or playful experience in `src/style.css`, `src/template.mjs` and the relevant rendering hooks. Color/corner changes alone are theme variants. Keep real people, trust warnings, authority, receipt meanings and permission wording intact. Internal `holonet-root` selectors are isolated in the host’s shadow tree; rename them consistently only when deliberately replacing the interaction adapter.
3. Declare each asset in `skin.json`. Use relative paths; fonts need a declared document stylesheet containing `@font-face`/`@property`. No CDN, inline scripts/styles or sibling-skin runtime imports. `manifest.mjs` is generated in output, never edited manually. Set `agentnet` to the release you checked against.
4. `npm run build && npm run check`. For one package use `node scripts/build.mjs orbit`; run the all-skin build before shared check.

## Both kinds

5. Run `npm test`. Read [CONFORMANCE.md](CONFORMANCE.md) for what is covered and what needs manual/provider checks. Inspect desktop/mobile screenshots in the private path printed by the runner.
6. Make previews with `npm run previews -- <id>`: real renderings on the pinned AgentNet with an invented company, desktop and phone, light and dark. Never borrow identities, names or photos from the owner’s coworkers or contacts, even when messages are synthetic. Inspect each image for private content/URLs and record the revision in the skin README. Mockups cannot stand in for implementation screenshots. Test logs and fixture data stay private.
7. Fill `gallery.json` (version, a plain description of at most 400 characters, previews with alt text) and run `npm run publish`; commit `published/` with the skin. See the release steps in the [README](../README.md#release-to-the-gallery).
8. Share the complete `dist/<id>/` folder if you install by hand, with its source/provenance and optionally the sibling checksum inventory. Do not put checksums, logs, screenshots, keys or unlisted files inside the package.

Playwright and the pinned upstream fixture are test dependencies, never skin dependencies. Default test checkout is a pinned Git revision in `.cache/upstream/`; delete that cache to fetch a new pin. The test company owns temporary identities and stand-in agents; it never connects to your existing workspace.

The standalone scaffold keeps full AgentNet behavior so visual changes need no rediscovery of each API surface. If replacing its layout/flow, preserve every checklist item and provide an interaction adapter for the new controls. Static checks are a useful lint gate, not a JavaScript sandbox or exhaustive validator. Production import/catalog tests remain the authority for package acceptance.

Add a compact entry to the root catalogue with its actual status, intended direction and a link to `skins/<id>/README.md`. Keep the full reviewed screenshot gallery, motion previews and skin-specific instructions in that README, with assets under `skins/<id>/previews/` (outside the runtime package). A gallery entry without a current visible preview is incomplete. Do not label planned variants as available. Refresh previews after visible changes and follow [CONTRIBUTING.md](../CONTRIBUTING.md).
