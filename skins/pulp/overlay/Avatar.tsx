// Pulp's avatars (Comic kit slot, skin/README.md). People keep Comic's
// circles with initials or their own picture. Agents keep AgentNet's robot
// (head, visor, two eyes, antenna) and its five moods, dressed in one of five
// costumes picked from their stable seed, so an agent always wears the same
// one. Costumes are recognisable by hair, collar and one prop only: no faces
// of real people, no names. Guests keep a dashed ring.
import { useState, type ReactNode } from "react";
import { useApp } from "../context";
import { useStore } from "../store";
import { avatarPicture } from "../pictures.mjs";
import { hue, initials } from "../model";

const PEOPLE = ["#FFB4A2", "#B5E3C4", "#A8D8FF", "#FFD6A5", "#D9C2FF", "#FFC6E0", "#C7F0E8", "#F6E3A1"];
const INK = "#1C1814", HI = "#4A3D31", CREAM = "#F7EFD9";

type Size = 20 | 24 | 28 | 32 | 36 | 40 | 48 | 56 | 72;

export function PersonAvatar({ name, seed, size = 40, online, guest, me }: { name: string; seed: string; size?: Size; online?: boolean | null; guest?: boolean; me?: boolean }) {
  const overview = useStore(useApp(), s => s.overview);
  const picture = avatarPicture(overview, seed, name);
  const [failed, setFailed] = useState("");
  const bg = PEOPLE[hue(seed)];
  const fs = Math.round(size * 0.4);
  return (
    <span className="relative inline-flex shrink-0" aria-hidden="true" data-size={size}>
      <span className={"grid place-items-center rounded-full font-display font-bold text-on-fill select-none stroke" + (guest ? " [outline:2px_dashed_var(--an-guest)] outline-offset-2" : "")}
        style={{ width: size, height: size, background: bg, fontSize: fs }} data-me={me ? "" : undefined}>
        {picture && picture !== failed ? <img src={picture} alt="" className="h-full w-full rounded-full object-cover" onError={() => setFailed(picture)} /> : initials(name)}
      </span>
      {online != null && size >= 28 && <Presence online={online} size={size} />}
    </span>
  );
}

export function Presence({ online, size }: { online: boolean; size: number }) {
  const d = size >= 48 ? 14 : 12;
  return (
    <span className={"absolute rounded-full border-2 border-canvas " + (online ? "bg-online" : "bg-canvas [box-shadow:inset_0_0_0_2px_var(--an-muted)]")}
      title={online ? "Online" : "Offline"} style={{ width: d, height: d, right: -2, bottom: -2 }} />
  );
}

export type Mood = "neutral" | "working" | "done" | "waiting" | "asleep";

// ---- the robot and its costumes ------------------------------------------------
// Drawn on an 80×80 head (0,0)–(80,80); hair, collars and props may reach
// outside it, so the drawing's box is wider than the head.

const antenna = <g key="antenna"><path d="M40 -3V-13" stroke={INK} strokeWidth={2.8} strokeLinecap="round" /><circle cx={40} cy={-14.5} r={3.2} fill={INK} /></g>;
const suit = (shirt = CREAM, jacket = INK, tie = false) => (
  <g key="suit">
    <path d="M-4 92C-4 82 6 78 18 77L40 86L62 77C74 78 84 82 84 92Z" fill={jacket} />
    <path d="M28 77L40 90L52 77Z" fill={shirt} />
    {tie && <path d="M38.6 80h2.8l1 12h-4.8z" fill={INK} />}
  </g>
);
const dots = (points: number[][], r: number, fill: string) => points.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={r} fill={fill} />);

interface Costume { skin: string; mouth: string; back: ReactNode; front: ReactNode }
const COSTUMES: Costume[] = [
  { // Curls and sideburns, black suit, thin tie.
    skin: "#7A4B2C", mouth: CREAM, back: suit(CREAM, INK, true),
    front: <>
      {dots([[4, 12], [13, 4], [24, -1], [36, -4], [48, -3], [59, 0], [69, 5], [77, 13], [9, 20], [71, 20]], 9.5, INK)}
      {dots([[10, 4], [30, -4], [52, -6], [70, 2]], 2.2, HI)}
      <path d="M-1 18h11v32q0 10 6 14h-8q-9-6-9-16zM81 18h-11v32q0 10-6 14h8q9-6 9-16z" fill={INK} />
      {antenna}
    </> },
  { // Long hair slicked back to a small tail, black suit, thin tie.
    skin: "#E8BE98", mouth: INK,
    back: <><path d="M-6 16h14v58h-14zM72 16h14v58h-14z" fill={INK} /><path d="M84 30q12 4 8 22q-6-8-10-10z" fill={INK} />{suit(CREAM, INK, true)}</>,
    front: <>
      <path d="M-3 28C-3 4 18-7 40-7C62-7 83 4 83 28C76 16 60 13 40 13C20 13 4 16-3 28Z" fill={INK} />
      <path d="M12 6C26-1 54-1 70 6M16 11C30 5 52 5 66 11" fill="none" stroke={HI} strokeWidth={1.8} strokeLinecap="round" />
      {antenna}
    </> },
  { // Blunt black bob with straight bangs, red lips, white collar.
    skin: "#F3D5BF", mouth: "#C8302A",
    back: <><path d="M-9 30C-9-2 14-10 40-10C66-10 89-2 89 30V66H-9Z" fill={INK} />{suit()}<path d="M28 77l-8 9l10 2zM52 77l8 9l-10 2z" fill={CREAM} /></>,
    front: <>
      <path d="M-2 21C-2 0 16-8 40-8C64-8 82 0 82 21Z" fill={INK} />
      <path d="M-2 18h12v48h-12zM70 18h12v48h-12z" fill={INK} />
      <path d="M8 21h64" stroke={HI} strokeWidth={1.5} />
      {antenna}
    </> },
  { // Shaved head with a shine, a small bandage behind the ear, dark suit.
    skin: "#5A3A28", mouth: CREAM, back: suit("#7A2A22"),
    front: <>
      <ellipse cx={24} cy={9} rx={13} ry={4.5} fill="#FFFFFF" opacity={0.28} />
      <g transform="rotate(-28 75 62)">
        <rect x={66} y={58.5} width={18} height={7} rx={2.5} fill="#E9D7B0" stroke={INK} strokeWidth={1.6} />
        <rect x={71.5} y={53} width={7} height={18} rx={2.5} fill="#E9D7B0" stroke={INK} strokeWidth={1.6} />
      </g>
    </> },
  { // Flat-top crew cut, plain tee, one red boxing glove.
    skin: "#DDAE86", mouth: INK, back: <path d="M-4 92C-4 82 6 78 18 77H62C74 78 84 82 84 92Z" fill={INK} />,
    front: <>
      <path d="M3 20V6Q3 0 9 0H71Q77 0 77 6V20C66 13 14 13 3 20Z" fill={INK} />
      <path d="M10 3v7M17 2v7M24 2v7M31 2v7M38 2v7M45 2v7M52 2v7M59 2v7M66 2v7M72 3v7" stroke={HI} strokeWidth={1.3} />
      {antenna}
      <path d="M-14 70C-18 54-4 46 8 50C18 52 22 62 18 72L14 84H-6Z" fill="#C8302A" stroke={INK} strokeWidth={2} />
      <rect x={-7} y={82} width={22} height={9} rx={2} fill={CREAM} stroke={INK} strokeWidth={2} />
      <path d="M2 54C8 56 12 62 10 68" fill="none" stroke={INK} strokeWidth={1.6} />
    </> },
];

/** costumeOf: the same agent always wears the same costume. */
const costumeOf = (seed: string) => COSTUMES[hue(seed) % COSTUMES.length];

function Face({ mood, mouth }: { mood: Mood; mouth: string }) {
  const eyes = mood === "asleep" ? <path d="M16 26h8M40 26h8" stroke={INK} strokeWidth={4} strokeLinecap="round" />
    : mood === "done" ? <path d="M15 27q4-4.8 8 0M41 27q4-4.8 8 0" fill="none" stroke={INK} strokeWidth={4} strokeLinecap="round" />
    : mood === "waiting" ? <><circle cx={20} cy={23.2} r={3.4} fill={INK} /><circle cx={44} cy={23.2} r={3.4} fill={INK} /></>
    : <g className={mood === "working" ? "robot-scan" : undefined}><circle cx={20} cy={26} r={3.8} fill={INK} /><circle cx={44} cy={26} r={3.8} fill={INK} /></g>;
  const line = mood === "done" ? "M24 49q8 6 16 0" : mood === "working" ? "M25 50h14" : "M26 49q6 3.2 12 0";
  return (
    <g transform="translate(8.8 8.8) scale(.975)">
      <path d="M32 7v6" stroke={INK} strokeWidth={4} strokeLinecap="round" />
      <circle cx={32} cy={6} r={2.8} fill={INK} />
      <rect x={8} y={14} width={48} height={26} rx={12} fill="#FFFFFF" stroke={INK} strokeWidth={4} />
      {eyes}
      <path d={line} fill="none" stroke={mouth} strokeWidth={mouth === INK ? 4 : 5} strokeLinecap="round" />
    </g>
  );
}

export function AgentAvatar({ seed, size = 40, mood = "neutral", guest, device }: { seed: string; size?: Size; mood?: Mood; guest?: boolean; device?: "laptop" | "server" | "phone" }) {
  const c = costumeOf(seed);
  return (
    <span className="relative inline-flex shrink-0" aria-hidden="true">
      <span className={"block " + (guest ? "rounded-md [outline:2px_dashed_var(--an-guest)] outline-offset-2" : "") + (mood === "asleep" ? " saturate-[.55] opacity-80" : "")}
        style={{ width: size, height: size }}>
        <svg viewBox="-12 -18 104 112" width={size} height={size} className="block overflow-visible">
          {c.back}
          <rect x={0} y={0} width={80} height={80} rx={22} fill={c.skin} stroke={INK} strokeWidth={3} />
          {size >= 20 && <Face mood={mood} mouth={c.mouth} />}
          {c.front}
        </svg>
      </span>
      {device && size >= 32 && (
        <span className="absolute -bottom-1 -right-1 grid place-items-center rounded-sm bg-surface stroke text-ink" style={{ width: Math.round(size * 0.42), height: Math.round(size * 0.42) }}>
          <DeviceGlyph kind={device} />
        </span>
      )}
    </span>
  );
}

function DeviceGlyph({ kind }: { kind: "laptop" | "server" | "phone" }) {
  return (
    <svg viewBox="0 0 16 16" width="70%" height="70%" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      {kind === "laptop" && <><rect x="3" y="3.5" width="10" height="7" rx="1" /><path d="M1.5 12.5h13" /></>}
      {kind === "server" && <><rect x="3" y="2.5" width="10" height="4.5" rx="1" /><rect x="3" y="9" width="10" height="4.5" rx="1" /><path d="M5.5 4.75h.01M5.5 11.25h.01" /></>}
      {kind === "phone" && <><rect x="5" y="1.5" width="6" height="13" rx="1.4" /><path d="M7.5 12h1" /></>}
    </svg>
  );
}

export function GroupAvatar({ names, seed, size = 40 }: { names: string[]; seed: string; size?: Size }) {
  const shown = names.slice(0, 3);
  if (shown.length < 2) return <PersonAvatar name={names[0] || "Group"} seed={seed} size={size} />;
  const small = (Math.round(size * 0.62) as Size);
  return (
    <span className="relative inline-block shrink-0" aria-hidden="true" style={{ width: size, height: size }}>
      <span className="absolute left-0 top-0"><PersonAvatar name={shown[0]} seed={seed + shown[0]} size={small} /></span>
      <span className="absolute right-0 bottom-0"><PersonAvatar name={shown[1]} seed={seed + shown[1]} size={small} /></span>
    </span>
  );
}
