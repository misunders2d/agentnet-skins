# Compatibility policy

- Host API **v1** is the consumed contract. Each manifest declares `api:1`.
- Baseline: AgentNet **v0.8.1**, exact commit in `upstream.json`. Tests fetch/archive that revision, never `main`.
- Additive host methods remain optional: feature-detect and handle rejection. `platform:"daemon"` alone does not imply native app capabilities.
- A workspace host never changes membership. Capture it when an operation starts; do not retarget/replay staged files, sends, downloads or provider calls.
- Shared scaffold packages use their own manifest identity and workspace draft namespace. Identity never reads undocumented `host.skin`; the manifest is sufficient.
- Updating upstream is a deliberate pin change: inspect contract/source changes, refresh retained modules, update provenance, run all tests and review screenshots. No compatibility claim for newer/older releases without checks.
- Packages distribute independently. Build/test dependencies belong to this collection; runtime assets never depend on a sibling package or development checkout.
- Native and browser-local installation use the same package bytes; their digest consent is per origin/browser. A changed digest requires new trust.
