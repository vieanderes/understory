'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';

/*
 * The platform's confirmation dialogs (submit, quit, change language, ready to start),
 * on the native <dialog>: showModal traps focus, Escape cancels and the page behind is
 * inert, with no focus-trap code of our own.
 */

interface DialogProps {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  /** Null for a dialog that only informs: one button, which closes it. */
  cancelLabel?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
  /** The confirm button is the primary action unless this is a way out. */
  tone?: 'primary' | 'quiet';
}

export function Dialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  tone = 'primary',
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const informs = cancelLabel === null;

  // Syncing a DOM API to a prop, not mirroring state: the dialog's modality lives in the
  // browser, and showModal is the only way to reach it.
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal?.();
      // A dialog that only informs can be long. showModal focuses its one button at the
      // bottom and scrolls the start away, so it starts at the title instead.
      if (informs) {
        titleRef.current?.focus();
        dialog.scrollTop = 0;
      }
    }
    if (!open && dialog.open) dialog.close?.();
  }, [open, informs]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      className="bg-surface text-fg rounded-panel shadow-float backdrop:bg-bg/70 m-auto w-full max-w-lg overscroll-contain p-0"
    >
      {open ? (
        <div className="flex flex-col gap-2 p-3">
          <h2
            ref={titleRef}
            id={titleId}
            tabIndex={informs ? -1 : undefined}
            className="text-lg font-semibold outline-none"
          >
            {title}
          </h2>
          <div className="text-muted flex flex-col gap-1 text-base">{children}</div>
          <div className="flex flex-wrap justify-end gap-1 pt-1">
            {cancelLabel === null ? null : (
              <Button variant="quiet" size="md" onClick={onCancel}>
                {cancelLabel}
              </Button>
            )}
            <Button
              variant={tone === 'primary' ? 'primary' : 'secondary'}
              size="md"
              onClick={onConfirm}
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
