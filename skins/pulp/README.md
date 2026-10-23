# Pulp

A 1970s paperback by day and a roadside diner by night, on AgentNet's own
interface. Pulp is an **overlay skin**: it is Comic, AgentNet's default skin,
with its own skin layer (`overlay/`), so it has every Comic feature (chats,
topics, agents, approvals, files, people, settings, workspaces) and picks up
Comic's fixes whenever it is rebuilt.

- **Contents.** The chat list reads like a table of contents: dotted leaders
  and unread counts set like page numbers.
- **Chapters.** Every topic opens with a black title card ("Chapter Two").
- **The case.** A request that needs your OK arrives as a case that opens on
  its own, its gold lining under the request. Allow once, Decline and the
  other actions are AgentNet's own, always shown.
- **The cast.** Agents are AgentNet's robot in one of five costumes (curls
  and sideburns; long centre-parted hair combed back to the collar; a black bob; a shaved head with a
  bandage; a crew cut and a boxing glove), chosen from the agent's key, so
  each agent always wears the same one. Moods (working, waiting, done,
  asleep) stay as in Comic.
- **Typed slips.** Messages are set in a typewriter face; an agent's reply
  sits on a red offset print. Send is a rubber stamp; typing shows two
  dancing feet.
- **Day and night.** Paper and press-black ink, or diner neon. Reduced
  motion turns every animation off.

## Previews

The four images below were regenerated and inspected through the production loader on AgentNet v0.9.3 at [`76da6ed826004067e82ed2b639022760a99de587`](https://github.com/misunders2d/agentnet/tree/76da6ed826004067e82ed2b639022760a99de587), using the disposable fictional Brightwater Ceramics company. They show desktop 1440 × 1000 and phone 390 × 844 in light/dark themes. Phone screenshots use Chromium viewport emulation; physical-phone behavior remains separate.

The current source targets AgentNet v0.9.3 at [`3f5bbc4362e1ee6345c676e9000ee742668c64ad`](https://github.com/misunders2d/agentnet/tree/3f5bbc4362e1ee6345c676e9000ee742668c64ad). The collection retains complete unchanged qualification and reruns affected checks, including the rebuilt Comic overlays. Published in [gallery v2026.10.23.1](https://github.com/misunders2d/agentnet-skins/releases/tag/v2026.10.23.1). [PROVENANCE.md](../../PROVENANCE.md) records the exact source, retained and repeated checks, original failures and evidence limits.

| Desktop, day | Desktop, night |
| --- | --- |
| ![Pulp on a desktop, day](previews/desktop-light.png) | ![Pulp on a desktop, night](previews/desktop-dark.png) |

| Phone, day | Phone, night |
| --- | --- |
| ![Pulp on a phone, day](previews/mobile-light.png) | ![Pulp on a phone, night](previews/mobile-dark.png) |

Targets Host API v1; `"agentnet": "v0.9.3"`. The overlay is rebuilt by the exact pinned Comic source.

## What is in the overlay

| File | Replaces Comic's |
| --- | --- |
| `theme.css` | Colours, fonts, corners and the part styles (contents leaders, typed slips, offset print, feet) plus Pulp's own pieces (stamp, chapter card, case) |
| `document.css`, `fonts/` | Bitter, PT Sans Narrow and PT Mono (SIL Open Font License; licenses in `fonts/`), all with Cyrillic |
| `brand.tsx` | Name, Settings line, the paperback mark, "Contents", storage under `pulp.` |
| `Avatar.tsx` | The costumed robots |
| `SendButton.tsx` | The stamp |
| `TopicIntro.tsx` | The chapter card |
| `RequestFrame.tsx` | The case |

## Inspiration and limits

Inspired by pulp-era paperbacks, diners and 1990s crime films in general. It
uses no film title, logo, poster layout, dialogue, character names or actor
likeness; costumes are generic hair, clothes and one prop on AgentNet's own
robot.

## License

Apache-2.0, like AgentNet's Comic it builds on. Fonts: SIL Open Font License
1.1 (see `overlay/fonts/LICENSE-*.txt`).
