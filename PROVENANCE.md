# Source provenance

Baseline: [misunders2d/agentnet v0.8.1](https://github.com/misunders2d/agentnet/tree/daddab38d229f695936a6d975702668b381f3135), commit `daddab38d229f695936a6d975702668b381f3135`, Apache-2.0.

| Local source | Pinned upstream source | Changes |
| --- | --- | --- |
| `skins/holonet/src/{entry,template,style,typing,drivespace,drivespace-setup,assistant-setup,qr}.*` | `internal/ui/skins/classic/src/` | Full behavior retained; manifest identity, root selector, original Holonet cockpit template/layout and industrial styling; CSS classes replace CSP-forbidden style attributes; root mounting class replaces visibility style; obsolete bottom-bar padding removed; explicit modal attributes; exact-message notifications select their topic; manifest identity without undocumented host.skin; direction-bound file download links survive view rerenders |
| `skins/holonet/src/topics.mjs` | `internal/ui/skins/shared/topics.mjs` | Package-local copy; awaited topic selection preserves keyboard focus |
| `skins/holonet/src/{optimistic,pictures}.mjs` | `internal/ui/static/` | Package-local copies |
| `tests/contract.cjs` | `internal/ui/testdata/skin_contract_check.cjs` | Resolve host assets from pinned test checkout; scaffold-family journey; synthetic company DM notification target; no machine-specific browser path |
| `tests/lifecycle.cjs` | `internal/ui/testdata/classic_contract_check.cjs` | Dynamic package/manifest identity; absent optional capabilities; two-membership draft journey; portable paths |
| Test fixture | `internal/ui/testdata/company_world.sh`, `company_seed.sh` | Fetched from exact pinned revision in ignored cache; wrapper installs packages only in disposable homes; URL parser strips fixture CLI explanatory text |

Holonet cockpit layout, console styling, `signal.svg`, `skin-motion.mjs`, shared collection tools, browser journeys and documentation are original additions. Topic/conversation acquisition uses a cancellable decorative instrument sweep; dialog openings use split shutters. Controls and content remain usable immediately. Reduced motion skips both effects, and native closing/unmount cancels them. The SVG is geometric artwork, not a franchise logo. No external font/image asset is loaded. Existing Classic app-icon asset was not copied.

`qr.mjs` retains Paul Miller’s 2023 copyright and `MIT OR Apache-2.0` notice. This distribution selects Apache-2.0. Playwright is a development dependency under its upstream Apache-2.0 license, not bundled in packages.

Design references only: the official [Imperial Security Bureau control center](https://www.starwars.com/databank/imperial-security-bureau-control-center) and [Millennium Falcon cockpit experience](https://www.starwars.com/news/7-things-we-learned-inside-the-millennium-falcon-experience) informed luminous structural ribs, industrial framing and physical control proportions. Reference photographs are not copied, bundled or published.

Builds generate `manifest.mjs` from each skin’s manifest and a checksum inventory outside the package. Generated build output, test checkout, synthetic homes, keys, logs and screenshots are ignored and not part of source publication.
