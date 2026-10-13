// Pulp's send control (Comic kit slot, skin/README.md): a rubber stamp.
// Still a submit button named by `label` (Send, Send your reply…), refusing
// while not ready or busy, keeping focus in the field on a tap.
import type { MouseEvent as ReactMouseEvent } from "react";

/** keep stops a tap from taking focus off the text field. */
const keep = (e: ReactMouseEvent) => e.preventDefault();

export function SendButton({ ready, busy, label }: { ready: boolean; busy: boolean; label: string }) {
  return (
    <button type="submit" data-part="send" onMouseDown={keep} aria-disabled={!ready || busy} aria-label={label} title={label}
      className={"pulp-stamp self-end " + (ready ? "" : "pulp-stamp-off")}>
      {busy ? <span className="pulp-feet" aria-hidden="true"><i /><i /></span> : <span aria-hidden="true">Send</span>}
    </button>
  );
}
