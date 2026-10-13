// Pulp's identity (Comic kit slot, skin/README.md): a 1970s paperback and a
// roadside diner over AgentNet's own interface.

export const skin = {
  id: "pulp",
  name: "Pulp",
  blurb: "Chats as a paperback’s contents, topics as chapters, agents in costume.",
  storage: "pulp",
  themeKey: "pulp.theme",
};

/** The list reads like a paperback's table of contents. */
export const words = {
  chats: "Contents",
};

/** A paperback cover: mustard stock, a red title band, press-black ink. */
export function Mark() {
  return (
    <svg viewBox="0 0 44 44" className="size-11 shrink-0" aria-hidden="true">
      <rect x="6" y="2" width="32" height="40" rx="2" fill="#E8B53C" stroke="#1C1814" strokeWidth="2" />
      <rect x="6" y="2" width="32" height="11" fill="#B3261E" stroke="#1C1814" strokeWidth="2" />
      <path d="M11 20h22M11 25h22M11 30h14" stroke="#1C1814" strokeWidth="2" strokeDasharray="1.5 2.5" strokeLinecap="round" />
      <path d="M33 36l3-3" stroke="#1C1814" strokeWidth="2" />
    </svg>
  );
}
