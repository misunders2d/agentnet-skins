# Source provenance

Baseline: [misunders2d/agentnet v0.8.1](https://github.com/misunders2d/agentnet/tree/daddab38d229f695936a6d975702668b381f3135), commit `daddab38d229f695936a6d975702668b381f3135`, Apache-2.0.

| Local source | Pinned upstream source | Changes |
| --- | --- | --- |
| `skins/holonet/src/{entry,template,style,typing,drivespace,drivespace-setup,assistant-setup,qr}.*` | `internal/ui/skins/classic/src/` | Full behavior retained; manifest identity, root selector, original Holonet branding/design; CSS classes replace CSP-forbidden style attributes; root mounting class replaces visibility style; obsolete bottom-bar padding removed; explicit modal attributes; exact-message notifications select their topic; manifest identity without undocumented host.skin; direction-bound file download links survive view rerenders |
| `skins/holonet/src/topics.mjs` | `internal/ui/skins/shared/topics.mjs` | Package-local copy |
| `skins/holonet/src/{optimistic,pictures}.mjs` | `internal/ui/static/` | Package-local copies |
| `tests/contract.cjs` | `internal/ui/testdata/skin_contract_check.cjs` | Resolve host assets from pinned test checkout; scaffold-family journey; synthetic company DM notification target; no machine-specific browser path |
| `tests/lifecycle.cjs` | `internal/ui/testdata/classic_contract_check.cjs` | Dynamic package/manifest identity; absent optional capabilities; two-membership draft journey; portable paths |
| Test fixture | `internal/ui/testdata/company_world.sh`, `company_seed.sh` | Fetched from exact pinned revision in ignored cache; wrapper installs packages only in disposable homes; URL parser strips fixture CLI explanatory text |

Holonet console styling, `signal.svg`, shared collection tools, browser journeys and documentation are original additions. The SVG is geometric artwork, not a franchise logo. No external font/image asset is loaded. Existing Classic app-icon asset was not copied.

`qr.mjs` retains Paul Miller’s 2023 copyright and `MIT OR Apache-2.0` notice. This distribution selects Apache-2.0. Playwright is a development dependency under its upstream Apache-2.0 license, not bundled in packages.

Builds generate `manifest.mjs` from each skin’s manifest and a checksum inventory outside the package. Generated build output, test checkout, synthetic homes, keys, logs and screenshots are ignored and not part of source publication.
