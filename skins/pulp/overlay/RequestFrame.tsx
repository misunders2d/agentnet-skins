// Pulp's request frame (Comic kit slot, skin/README.md): a request waiting
// for your OK arrives as a case that opens on its own, its gold lining under
// the request; a running one is an open case; a stopped or handed-over one is
// a plain slip. Everything inside (who asks, what, every action) is the
// interface's own and always shown: no extra step before the actions.
import type { ReactNode } from "react";
import { timeOf } from "../model";

export function RequestFrame({ tone, label, at, children, labelledBy }: { tone: "act" | "work" | "quiet"; label: string; at: string; children: ReactNode; labelledBy?: string }) {
  return (
    <article aria-labelledby={labelledBy} data-part="request" data-tone={tone} className={"pulp-case pulp-case-" + tone}>
      <header className="pulp-case-lid">
        {tone !== "quiet" && <span className="pulp-latch" aria-hidden="true" />}
        <span className="pulp-case-label">
          {tone === "work" && <span className="pulp-feet" aria-hidden="true"><i /><i /></span>}
          {label}
        </span>
        <time dateTime={at} className="pulp-case-time tnum">{timeOf(at)}</time>
        {tone !== "quiet" && <span className="pulp-latch" aria-hidden="true" />}
      </header>
      <div className="pulp-case-lining">{children}</div>
    </article>
  );
}
