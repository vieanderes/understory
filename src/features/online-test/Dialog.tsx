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
  cancelLabel?: string;
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

  // Syncing a DOM API to a prop, not mirroring state: the dialog's modality lives in the
  // browser, and showModal is the only way to reach it.
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal?.();
    if (!open && dialog.open) dialog.close?.();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      className="bg-surface text-fg rounded-panel shadow-float backdrop:bg-bg/70 m-auto w-full max-w-lg p-0"
    >
      {open ? (
        <div className="flex flex-col gap-2 p-3">
          <h2 id={titleId} className="text-lg font-semibold">
            {title}
          </h2>
          <div className="text-muted flex flex-col gap-1 text-base">{children}</div>
          <div className="flex flex-wrap justify-end gap-1 pt-1">
            <Button variant="quiet" size="md" onClick={onCancel}>
              {cancelLabel}
            </Button>
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
