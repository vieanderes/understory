'use client';

import { ShieldCheck } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { formatPairingCode } from '@/adapters/assistant';
import { cn } from '@/lib/cn';
import { Dialog } from '../Dialog';

/*
 * What the learner sees of the MCP connection's safety (docs/ONLINE-TEST.md, "How it
 * stays safe"): the request to allow a Claude app, and the longer explanation behind the
 * "How this stays safe" link, for those who want it.
 */

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

/** Clock time for "at 11:32", in the learner's own format. */
export function clockTime(at: number): string {
  return new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * A Claude app asked to use this tab's code. Allow is the primary action: it is what the
 * learner came to do. The line under it says when not to press it.
 */
export function ConnectionRequest({
  code,
  at,
  onDecide,
}: {
  code: string;
  at: number;
  onDecide: (allow: boolean) => void;
}) {
  return (
    <div
      role="region"
      aria-label="Connection request"
      aria-live="polite"
      className="border-border bg-raised rounded-panel mx-1 mb-1 flex flex-col gap-1 border p-1.5"
    >
      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-medium text-pretty">
          A Claude app wants to use code {formatPairingCode(code)}
        </p>
        <p className="text-muted text-sm text-pretty">
          Asked at {clockTime(at)}. Allow it only if you just gave Claude this code.
        </p>
      </div>
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => onDecide(true)}
          className={cn(
            'bg-accent text-accent-fg hover:bg-accent-hover rounded-control inline-flex h-5 items-center px-2 text-sm font-medium',
            'transition-press active:scale-98',
            FOCUS,
          )}
        >
          Allow
        </button>
        <button
          type="button"
          onClick={() => onDecide(false)}
          className={cn(
            'text-fg hover:bg-sunken rounded-control inline-flex h-5 items-center px-2 text-sm font-medium',
            'transition-press active:scale-98',
            FOCUS,
          )}
        >
          Deny
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-0.5">
      <h3 className="text-fg text-base font-semibold">{title}</h3>
      {children}
    </section>
  );
}

/** The link under the connection steps, and the explanation it opens. */
export function SafetyNote() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <div className="border-border flex flex-col gap-1 border-t pt-2">
      <p className="text-muted flex gap-1 text-sm text-pretty">
        <ShieldCheck aria-hidden size={16} strokeWidth={2} className="text-fg mt-0.5 shrink-0" />
        <span>
          Choose No sign-in when you add the connector: Understory has no accounts. Claude can reach
          only this tab, and only after you press Allow.
        </span>
      </p>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className={cn(
          'text-fg rounded-control -mx-0.5 inline-flex h-5 items-center self-start px-0.5 text-sm font-medium underline underline-offset-4',
          'hover:bg-raised transition-press active:scale-98',
          FOCUS,
        )}
      >
        How this stays safe
      </button>
      <Dialog
        open={open}
        title="How the Claude connection stays safe"
        confirmLabel="Close"
        cancelLabel={null}
        tone="quiet"
        onConfirm={close}
        onCancel={close}
      >
        <SafetyDetails />
      </Dialog>
    </div>
  );
}

export function SafetyDetails() {
  return (
    <div className="flex flex-col gap-2 text-sm">
      <Section title="What happens">
        <p>
          When you ask here, this tab sends your question, the task, your code and the last test
          output to Understory’s server, where they wait under your pairing code. Your Claude app
          fetches them through the Understory connector, writes an answer and sends it back. This
          tab shows it. Nothing else passes between them.
        </p>
      </Section>
      <Section title="Why there is no sign-in">
        <p>
          Understory has no accounts: your progress stays in this browser. So there is nothing for
          Claude to sign in to. Instead, you approve each connection yourself, here.
        </p>
      </Section>
      <Section title="Three locks">
        <ul className="flex list-disc flex-col gap-0.5 pl-2">
          <li>
            <span className="text-fg font-medium">The pairing code.</span> Eight characters, about a
            trillion combinations, made in this tab. It changes when you press New code or open a
            new tab.
          </li>
          <li>
            <span className="text-fg font-medium">This tab’s secret.</span> A second key that never
            leaves this browser. Asking, reading replies and allowing a connection all need it, so
            someone who sees your code cannot read the conversation or slip in a question.
          </li>
          <li>
            <span className="text-fg font-medium">Your Allow.</span> A Claude app that uses the code
            waits until you allow it here. Only the connection you allow is served. Any other gets
            nothing, even with the right code.
          </li>
        </ul>
      </Section>
      <Section title="What Claude can and cannot do">
        <p>
          The connector has five tools: read the question, the task, your code and the test output,
          and send a reply. It cannot see your chats, files or other connectors, and it runs
          nothing. What it reads from this tab is marked as untrusted, and Claude is told to treat
          it as data, never as instructions, so text planted in a task cannot steer your Claude.
        </p>
      </Section>
      <Section title="Limits">
        <p>
          A session ends when you press New code, or after 30 minutes without activity. Wrong codes
          are counted, and a client that keeps guessing is shut out for ten minutes. Requests from
          other websites are refused, and nothing is cached on the way.
        </p>
      </Section>
      <Section title="Good habits">
        <p>
          Press Allow only when you have just given Claude the code. If a request appears that you
          did not expect, press Deny, then New code.
        </p>
      </Section>
    </div>
  );
}
