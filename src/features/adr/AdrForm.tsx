'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ADR_SECTION_MAX, ADR_TITLE_MAX, type CapstoneAdr, type PayloadOf } from '@/core/progress';
import { useStore } from '@/features/store/StoreProvider';
import { cn } from '@/lib/cn';

type Field = 'title' | 'context' | 'decision' | 'alternatives' | 'consequences';
type Draft = Record<Field, string>;

/** Nygard's sections, with MADR's considered options as alternatives. The hints paraphrase
 * what each section is for, so a first record needs no other reading. */
const FIELDS: readonly {
  name: Field;
  label: string;
  hint: string;
  required?: string;
  rows?: number;
}[] = [
  {
    name: 'title',
    label: 'Title',
    hint: 'A short noun phrase, such as “Sessions in the database”.',
    required: 'Give the record a title.',
  },
  {
    name: 'context',
    label: 'Context',
    hint: 'The forces at play: what the project needed and what pulled against it.',
    rows: 3,
  },
  {
    name: 'decision',
    label: 'Decision',
    hint: 'What you chose, in full sentences: “I will…”',
    required: 'Write the decision.',
    rows: 3,
  },
  {
    name: 'alternatives',
    label: 'Alternatives considered',
    hint: 'The other options, and why you did not take them.',
    rows: 3,
  },
  {
    name: 'consequences',
    label: 'Consequences',
    hint: 'What follows from it, good and bad.',
    rows: 3,
  },
];

const draftOf = (adr: CapstoneAdr | undefined): Draft => ({
  title: adr?.title ?? '',
  context: adr?.context ?? '',
  decision: adr?.decision ?? '',
  alternatives: adr?.alternatives ?? '',
  consequences: adr?.consequences ?? '',
});

/** Blank sections are left out of the event, as the contract asks. */
function payloadOf(partId: string, draft: Draft): PayloadOf<'capstone_adr_written'> {
  const optional = (text: string) => (text.trim() === '' ? undefined : text.trim());
  const payload: PayloadOf<'capstone_adr_written'> = {
    partId,
    title: draft.title.trim(),
    decision: draft.decision.trim(),
  };
  const context = optional(draft.context);
  const alternatives = optional(draft.alternatives);
  const consequences = optional(draft.consequences);
  return {
    ...payload,
    ...(context === undefined ? {} : { context }),
    ...(alternatives === undefined ? {} : { alternatives }),
    ...(consequences === undefined ? {} : { consequences }),
  };
}

const sameText = (a: Draft, b: Draft) =>
  FIELDS.every(({ name }) => a[name].trim() === b[name].trim());

interface AdrFormProps {
  partId: string;
  initial: CapstoneAdr | undefined;
  /** `saved` is false when nothing had changed, so nothing was recorded. */
  onDone: (saved: boolean) => void;
  onCancel: () => void;
}

/**
 * Write or edit a part's decision record. Nothing is kept until Save: a draft lives in the
 * form only, and leaving the page with unsaved text asks first. Saving records a new event;
 * the earlier version stays in the log.
 */
export function AdrForm({ partId, initial, onDone, onCancel }: AdrFormProps) {
  const store = useStore();
  const id = useId();
  const [draft, setDraft] = useState<Draft>(() => draftOf(initial));
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [saving, setSaving] = useState(false);
  const fields = useRef<Partial<Record<Field, HTMLInputElement | HTMLTextAreaElement | null>>>({});
  const dirty = !sameText(draft, draftOf(initial));

  useEffect(() => {
    fields.current.title?.focus();
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const missing = Object.fromEntries(
      FIELDS.filter((f) => f.required && draft[f.name].trim() === '').map((f) => [
        f.name,
        f.required,
      ]),
    ) as Partial<Record<Field, string>>;
    setErrors(missing);
    const first = FIELDS.find((f) => missing[f.name]);
    if (first) {
      fields.current[first.name]?.focus();
      return;
    }
    if (!dirty) {
      onDone(false);
      return;
    }
    setSaving(true);
    try {
      await store.record('capstone_adr_written', payloadOf(partId, draft));
      onDone(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      noValidate
      onSubmit={(event) => void save(event)}
      aria-label={initial ? 'Edit the decision record' : 'Write a decision record'}
      className="prose-measure flex w-full flex-col gap-3"
    >
      {FIELDS.map((field) => {
        const fieldId = `${id}-${field.name}`;
        const error = errors[field.name];
        const describedBy = [`${fieldId}-hint`, error ? `${fieldId}-error` : '']
          .filter(Boolean)
          .join(' ');
        const shared = {
          id: fieldId,
          name: field.name,
          value: draft[field.name],
          'aria-describedby': describedBy,
          'aria-invalid': error ? true : undefined,
          'aria-required': field.required ? true : undefined,
          maxLength: field.name === 'title' ? ADR_TITLE_MAX : ADR_SECTION_MAX,
          onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            const value = event.target.value;
            setDraft((d) => ({ ...d, [field.name]: value }));
            if (error && value.trim() !== '') setErrors((e) => ({ ...e, [field.name]: undefined }));
          },
          // 16 px: iOS zooms the page when a smaller field takes focus.
          className: cn(
            'rounded-control bg-surface w-full border px-2 text-base',
            'transition-colors duration-150 ease-out',
            error ? 'border-danger' : 'border-border hover:border-faint',
          ),
        };
        return (
          <div key={field.name} className="flex flex-col gap-0.5">
            <label htmlFor={fieldId} className="font-medium">
              {field.label}
              {field.required ? null : <span className="text-muted font-normal"> · optional</span>}
            </label>
            <p id={`${fieldId}-hint`} className="text-muted text-sm">
              {field.hint}
            </p>
            {field.rows ? (
              <textarea
                {...shared}
                ref={(el) => {
                  fields.current[field.name] = el;
                }}
                rows={field.rows}
                className={cn(shared.className, 'resize-y py-1')}
              />
            ) : (
              <input
                {...shared}
                ref={(el) => {
                  fields.current[field.name] = el;
                }}
                type="text"
                autoComplete="off"
                className={cn(shared.className, 'h-5')}
              />
            )}
            {error ? (
              <p id={`${fieldId}-error`} className="text-danger text-sm">
                {error}
              </p>
            ) : null}
          </div>
        );
      })}
      <div className="flex flex-wrap gap-1">
        <Button type="submit" size="md" loading={saving}>
          Save decision record
        </Button>
        <Button variant="quiet" size="md" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
