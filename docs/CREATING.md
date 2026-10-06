# Create and share a skin

1. Run `npm run new-skin -- orbit "Orbit"`. IDs start with a lowercase letter, contain lowercase letters/digits/hyphens and have at most 48 characters. Built-in IDs `comic`, `classic`, `zoom`, `default` and display names Comic/Classic/Zoom are reserved.
2. Edit `skins/orbit/src/style.css` and branding in `src/template.mjs`. Keep real people, trust warnings, authority, receipt meanings and permission wording intact. Internal `holonet-root` selectors are isolated in the host’s shadow tree; rename them consistently only when deliberately replacing the interaction adapter.
3. Declare each asset in `skin.json`. Use relative paths; fonts need a declared document stylesheet containing `@font-face`/`@property`. No CDN, inline scripts/styles or sibling-skin runtime imports. `manifest.mjs` is generated in output, never edited manually.
4. Run `npm run build && npm run check`. This builds every directory. For one package use `node scripts/build.mjs orbit`; run the all-skin build before shared check.
5. Run `npm test`. Read [CONFORMANCE.md](CONFORMANCE.md) for what is covered and what needs manual/provider checks. Inspect desktop/mobile screenshots in the private path printed by the runner.
6. Share the complete `dist/orbit/` folder, its source/provenance and optionally the sibling checksum inventory. Do not put checksums, logs, screenshots, keys or unlisted files inside the package.

Build uses Node only. Playwright and the pinned upstream fixture are test dependencies, never skin dependencies. Default test checkout is a public pinned Git revision in `.cache/upstream/`; delete that cache to fetch a new pin. The test company owns temporary identities and stand-in agents; it never connects to your existing workspace.

The scaffold keeps full AgentNet behavior so visual changes need no rediscovery of each API surface. If replacing its layout/flow, preserve every checklist item and provide an interaction adapter for the new controls. Static checks are a useful lint gate, not a JavaScript sandbox or exhaustive validator. Production import/catalog tests remain the authority for package acceptance.

Add your skin to the root gallery with its actual status, intended direction and source. Do not label planned variants as available.
