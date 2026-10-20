# Compatibility policy

- Host API **v1** is the consumed contract. Each manifest declares `api:1`.
- Pin: AgentNet at exact commit `d5318cd92ccd48ebdc5caf771c409b2beb0104b4`, the v0.9.1 source, in `upstream.json` (version `v0.9.1`). Tests archive or fetch that revision, never a moving `main` or working-tree changes.
- A skin's optional `agentnet` field names the required release (`"agentnet": "v0.9.1"`): an older AgentNet leaves it out of its catalog, and the skin gallery lists it as incompatible there. Every skin here names `v0.9.1`. AgentNet v0.8.24 and older also reserve the ids `classic` and `zoom` for their built-in copies. The release gate is the complete pinned collection test, including disposable standalone and overlay scaffolds; a successful build alone is insufficient. Physical devices and live provider behavior require separate evidence.
- Current status: exact-pin complete qualification and publication for v0.9.1 are pending; twenty previews were refreshed and inspected on production-identical 771e738e. The v0.9.0 results in [PROVENANCE.md](../PROVENANCE.md) are historical and do not qualify this candidate.
- Overlay skins are built by the pinned AgentNet itself (its Comic build), so their `agentnet` must equal the pin’s version; moving the pin rebuilds them with that release’s Comic.
- Additive host methods remain optional: feature-detect and handle rejection. `platform:"daemon"` alone does not imply native app capabilities.
- A workspace host never changes membership. Capture it when an operation starts; do not retarget/replay staged files, sends, downloads or provider calls.
- Packages use their own manifest identity and workspace draft namespace. Identity never reads undocumented `host.skin`; the manifest is sufficient.
- Updating upstream is a deliberate pin change: inspect contract/source changes, refresh retained modules, update provenance, run all tests, rebuild overlays, re-render previews where visible behavior changed and republish. No compatibility claim for newer/older releases without checks.
- Packages distribute independently. Build/test dependencies belong to this collection; runtime assets never depend on a sibling package or development checkout.
- Native, browser-local and gallery installation use the same package bytes; their digest consent is per origin/browser. A changed digest requires new trust.

Earlier v33 updates introduced unread Review, visible-only read acknowledgments,
shared topic rename/reset, lazy verified video and local scheduled messages. The
v0.9.1 source adds concrete agent/device identity, exact send recovery and cached
notification landing, plus a dedicated Outbox with Scheduled, Drafts and Reminders.
Drafts resume their original chat/agent/topic and available in-memory File objects;
attachment persistence across reload is not promised. Standalone views retain moved
or merged direct-topic originals; Comic and the CLI provide organization controls.
Pulp and Office inherit the pinned Comic implementation on rebuild. Complete
qualification of the v0.9.1 pin is pending. Schedules need the owning daemon running
or the browser page open at or after the deadline.
