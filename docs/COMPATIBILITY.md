# Compatibility policy

- Host API **v1** is the consumed contract. Each manifest declares `api:1`.
- Pin: AgentNet at exact commit `633025822ac9b6078fbb0a59fb8dff08d81e654b`, the v0.8.30 candidate, in `upstream.json` (version `v0.8.30`). Tests archive or fetch that revision, never a moving `main` or working-tree changes.
- A skin's optional `agentnet` field names the required release (`"agentnet": "v0.8.30"`): an older AgentNet leaves it out of its catalog, and the skin gallery lists it as incompatible there. Every skin here names `v0.8.30`. AgentNet v0.8.24 and older also reserve the ids `classic` and `zoom` for their built-in copies. The release gate is the complete pinned collection test, including disposable standalone and overlay scaffolds; a successful build alone is insufficient. Physical devices and live provider behavior require separate evidence.
- Overlay skins are built by the pinned AgentNet itself (its Comic build), so their `agentnet` must equal the pin’s version; moving the pin rebuilds them with that release’s Comic.
- Additive host methods remain optional: feature-detect and handle rejection. `platform:"daemon"` alone does not imply native app capabilities.
- A workspace host never changes membership. Capture it when an operation starts; do not retarget/replay staged files, sends, downloads or provider calls.
- Packages use their own manifest identity and workspace draft namespace. Identity never reads undocumented `host.skin`; the manifest is sufficient.
- Updating upstream is a deliberate pin change: inspect contract/source changes, refresh retained modules, update provenance, run all tests, rebuild overlays, re-render previews where visible behavior changed and republish. No compatibility claim for newer/older releases without checks.
- Packages distribute independently. Build/test dependencies belong to this collection; runtime assets never depend on a sibling package or development checkout.
- Native, browser-local and gallery installation use the same package bytes; their digest consent is per origin/browser. A changed digest requires new trust.
