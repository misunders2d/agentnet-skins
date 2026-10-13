// Pulp's topic intro (Comic kit slot, skin/README.md): every topic is a
// chapter, opened by a black title card. It sits above the messages and never
// hides or delays them; the main flow of a chat has no card.
export interface TopicFacts { title: string; main: boolean; state: "active" | "done" | "archived"; index?: number; at?: string; count: number }

const ORDINAL = ["One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve"];

function opened(at?: string) {
  if (!at) return "";
  const d = new Date(at);
  if (isNaN(+d)) return "";
  const today = new Date().toDateString() === d.toDateString();
  return "Opened " + (today ? "today " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : d.toLocaleDateString([], { day: "numeric", month: "short" }));
}

export function TopicIntro({ title, main, state, index, at, count }: TopicFacts) {
  if (main) return null;
  const chapter = index ? "Chapter " + (ORDINAL[index - 1] || index) : "Chapter";
  const when = opened(at);
  return (
    <section className="pulp-chapter" aria-label={chapter + ": " + title}>
      <span className="pulp-chapter-no">{chapter}</span>
      <span className="pulp-chapter-title">{title}</span>
      <span className="pulp-chapter-by">{[when, count === 1 ? "1 message" : count + " messages", state === "done" ? "Done" : state === "archived" ? "Archived" : ""].filter(Boolean).join(" · ")}</span>
    </section>
  );
}
