# Compatibility policy

- Host API **v1** is the consumed contract. Each manifest declares `api:1`.
- Pin: AgentNet at exact commit `55fc668fdbf04fdb84431b78e15770d9943d51c7`, the v0.8.29 candidate, in `upstream.json`. Tests archive or fetch that revision, never a moving `main` or working-tree changes.
- A skin's optional `agentnet` field names its required release. Pulp and Office require `v0.8.29`; standalone skins retain `v0.8.28`. Full `npm test` passes against this pinned candidate, including all standalone and overlay skins; the release owner must repin and qualify the final integrated release before tagging.
- Overlay skins are built by the pinned AgentNet itself (its Comic build), so their `agentnet` must equal the pin’s version; moving the pin rebuilds them with that release’s Comic.
- Additive host methods remain optional: feature-detect and handle rejection. `platform:"daemon"` alone does not imply native app capabilities.
- A workspace host never changes membership. Capture it when an operation starts; do not retarget/replay staged files, sends, downloads or provider calls.
- Packages use their own manifest identity and workspace draft namespace. Identity never reads undocumented `host.skin`; the manifest is sufficient.
- Updating upstream is a deliberate pin change: inspect contract/source changes, refresh retained modules, update provenance, run all tests, rebuild overlays, re-render previews where visible behavior changed and republish. No compatibility claim for newer/older releases without checks.
- Packages distribute independently. Build/test dependencies belong to this collection; runtime assets never depend on a sibling package or development checkout.
- Native, browser-local and gallery installation use the same package bytes; their digest consent is per origin/browser. A changed digest requires new trust.
