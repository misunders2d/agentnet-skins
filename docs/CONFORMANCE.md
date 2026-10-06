# Host API v1 conformance

Authoritative: [pinned UI_SKINS.md](https://github.com/misunders2d/agentnet/blob/daddab38d229f695936a6d975702668b381f3135/docs/UI_SKINS.md). This guide records the rules; it does not define a new API.

| Requirement | Implementation / shared evidence |
| --- | --- |
| Manifest API/identity, declared files, reserved names, safe paths, sizes | Shared build/check; negative manifest cases; actual installed/local importer |
| `mount(root, host)`, `unmount(root)`; own root only | Runtime checker mounts snapshotted package bytes at unrelated paths; A/B/A; empty root; no outside mutations |
| Transport through captured `host.api`, `listen`, `stage`, `file` | Runtime checker traps direct fetch/API/events/private globals; source lint rejects polling; native send and downloaded-byte journeys |
| Notifications | Required `onOpen` takes channel/conversation, opts into message/review; exact production message routing; untaken kinds remain host fallback |
| Draft/host integrity | Isolated two-host A/B/A drafts with identical conversation IDs, pending send across remount, reconnect retains text/retire staged files, no replay |
| Teardown | Unsubscribe streams/catalog; AbortController listeners; timers/object URLs cleaned; runtime listener and outside-DOM checks |
| Optional native clipboard/app/project space | Retained reference guards and captured callbacks; absent/rejected optional methods, app replacement cancel/confirm and partial-status merge, update preparation and native text paste exercised; unavailable controls explained/omitted; native OS/live provider behavior separate |
| Features/capabilities | Complete reference implementation; real sends/files, topics Done/Reopen, people/agents/activity/settings; core returns available actions |
| Responsive/accessibility | 1440/390, light/dark, keyboard-sized viewport with visible messages, readable composer and 44px send target, reduced motion, measured semantic contrast, settings focus containment, wrapping/root overflow, screenshots per major view |
| Action-linked motion | Actual production-loader assertions: repeat selection cancels its prior sweep; dialog close/reopen preserves new shutters; reduced motion skips effects; drafts/topic focus survive; crew closes/restores across resize; unmount while open cancels live animations |
| Trusted escape | Production host switcher outside skin; browser-local import/trust; Switch to Comic |
| File safety | Reference magic-byte picture checks, direction-aware `host.file`; never inline-execute HTML/SVG; actual download bytes verified during delayed host.file + topic rerender |

Package bounds: at most 32 packages; 32 declared assets per package, 4 MiB each, 16 MiB per package, 64 MiB catalog/browser storage. Do not set `builtin` or `digest`: the host computes trust/digests. Unix installs need owner-only writable directories/files and no symlinks.

Size every main frame from root with `height:100%`, not viewport-height units. The host positions its bar above the root. Popups stay inside root; bottom sheets read `--an-keyboard`/`--an-viewport-h`, never set them. Text from people/messages is rendered as text nodes. Opening a setting, notification or imported package must never silently approve or send.

Receipts prove custody/delivery/quarantine/expiry, never task completion. Execution/authority comes from core views and local grants. Keep identity/key warnings, browser restrictions, explicit Drive plaintext consent, app replacement confirmation and optional-method rejection handling.

## Evidence limits

Tests use captured Host API v1 adapters, a real pinned native provider/loader and an actual enrolled browser Engine/IndexedDB provider in a disposable local company. The scaffold-family selectors test concrete interactions; a different layout needs its own adapter rather than a superficial pass. Chromium viewport emulation is not a physical Android/iOS keyboard test. No live Google account/consent, real model, remote relay deployment or macOS/Windows runtime is claimed. Full-trust skins are never certified safe merely because tests pass.

Tests keep screenshots/results private; CI intentionally uploads none. Gallery publication additionally requires current screenshots of the real rendered implementation, with desktop/mobile and supported-theme coverage using synthetic content. Inspect images for private data, URLs and readability; record the tested revision and refresh after visible changes. Mockups are not implementation evidence, and a preview does not replace passing tests. Authors review privacy and permissions for depicted content; maintainers review gallery inclusion. Logs, keys and fixture data stay private. See the [PR checklist](../.github/pull_request_template.md).

A skin should offer a distinct layout, interaction or playful experience. A recolor/corner change is a theme variant. Compatibility tests do not establish visual design acceptance.
