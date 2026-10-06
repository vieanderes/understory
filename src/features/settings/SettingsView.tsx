'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { Button, buttonClass } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Segmented';
import { GOAL_XP_BY_TIER, type GoalTier } from '@/core/gamification';
import { DEFAULT_GOAL_TIER } from '@/core/insight';
import { DownloadCourse } from '@/features/pwa/DownloadCourse';
import { InstallExplainer } from '@/features/pwa/InstallExplainer';
import { requestPersistence } from '@/features/store/client';
import { useProgress, useStore } from '@/features/store/StoreProvider';

const TIERS = [
  { value: 'light', label: `Light · ${GOAL_XP_BY_TIER.light}` },
  { value: 'steady', label: `Steady · ${GOAL_XP_BY_TIER.steady}` },
  { value: 'deep', label: `Deep · ${GOAL_XP_BY_TIER.deep}` },
] as const;

type Notice = { tone: 'ok' | 'error'; text: string } | null;

function Row({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rule-t grid grid-cols-4 gap-x-4 gap-y-2 py-3 md:grid-cols-12">
      <div className="col-span-4 md:col-span-5">
        <h2 className="font-medium">{title}</h2>
        <p className="text-muted prose-measure text-sm">{note}</p>
      </div>
      <div className="col-span-4 flex flex-col items-start gap-2 md:col-span-7">{children}</div>
    </div>
  );
}

/**
 * Few settings, best defaults. Switches and segmented controls apply at once. Everything
 * that touches the log (export, import, erase) says exactly what it will do first.
 */
export function SettingsView() {
  const store = useStore();
  const { status, state, eventCount, durable } = useProgress();
  const [notice, setNotice] = useState<Notice>(null);
  const [confirmErase, setConfirmErase] = useState(false);
  const [busy, setBusy] = useState<'export' | 'import' | 'erase' | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const ready = status === 'ready';
  const adrCount = Object.keys(state.capstoneAdrs).length;

  async function exportLog() {
    setBusy('export');
    try {
      const file = await store.exportFile();
      const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `understory-${file.exportedAt.slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setNotice({ tone: 'ok', text: `${file.events.length} events exported.` });
    } finally {
      setBusy(null);
    }
  }

  async function importLog(file: File) {
    setBusy('import');
    try {
      const added = await store.importFile(JSON.parse(await file.text()));
      setNotice({
        tone: 'ok',
        text:
          added === 0
            ? 'Nothing new in that file. Your log already holds it.'
            : `${added} events merged.`,
      });
    } catch (error) {
      setNotice({
        tone: 'error',
        text:
          error instanceof SyntaxError ? 'That file is not valid JSON.' : (error as Error).message,
      });
    } finally {
      setBusy(null);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  async function erase() {
    setBusy('erase');
    await store.reset();
    setBusy(null);
    setConfirmErase(false);
    setNotice({ tone: 'ok', text: 'Progress on this device erased.' });
  }

  async function keep() {
    const granted = await requestPersistence();
    setNotice(
      granted
        ? { tone: 'ok', text: 'The browser will keep your progress.' }
        : {
            tone: 'error',
            text: 'The browser declined. Installing Understory or exporting regularly protects your progress.',
          },
    );
  }

  return (
    <div className="flex flex-col">
      <Row
        title="Your goals"
        note="What you want, what interests you, your time a day and whether Home shows the news. They shape your path, practice and news order."
      >
        <Link href="/plan?edit" className={buttonClass('secondary')}>
          Change my answers
        </Link>
      </Row>

      <Row
        title="Weekly goal"
        note="XP comes only from shown skill and recall. A missed week spends a rest week; you earn one for every four weeks met."
      >
        <div className="w-full max-w-60">
          <Segmented<GoalTier>
            label="Weekly goal in XP"
            hideLabel
            options={TIERS}
            value={ready ? (state.goalTier ?? DEFAULT_GOAL_TIER) : null}
            onChange={(tier) => void store.record('goal_tier_set', { tier })}
          />
        </div>
      </Row>

      <Row
        title="Offline"
        note="Lessons you have downloaded, the practice queue, the map and the code runner work with no connection. News needs one to fetch a new edition."
      >
        <DownloadCourse />
        <InstallExplainer />
      </Row>

      <Row
        title="Your progress file"
        note="Progress lives on this device as a log of what you did. Export it to keep a copy or to move to another device. Import merges: nothing is overwritten."
      >
        <p className="text-sm">
          <span className="t-figure">{ready ? eventCount : '··'}</span> events on this device
          {ready && !durable ? ' · not being saved in this window' : ''}
        </p>
        <div className="flex flex-wrap gap-1">
          <Button onClick={() => void exportLog()} loading={busy === 'export'} disabled={!ready}>
            Export
          </Button>
          <Button
            onClick={() => fileInput.current?.click()}
            loading={busy === 'import'}
            disabled={!ready}
          >
            Import
          </Button>
          <Button variant="quiet" onClick={() => void keep()} disabled={!ready}>
            Ask the browser to keep it
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            aria-label="Choose an Understory export file"
            tabIndex={-1}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void importLog(file);
            }}
          />
        </div>
      </Row>

      <Row
        title="Decision records"
        note="One architecture decision record per capstone, written when you build it. The log exports as Markdown for a portfolio."
      >
        <p className="text-sm">
          <span className="t-figure">{ready ? adrCount : '··'}</span>{' '}
          {ready && adrCount === 1 ? 'record' : 'records'} written
        </p>
        <Link href="/decisions" className={buttonClass('secondary')}>
          Open the ADR log
        </Link>
      </Row>

      <Row
        title="Erase progress"
        note="Removes every event from this device. An exported file is not affected."
      >
        {confirmErase ? (
          <div className="flex flex-wrap items-center gap-1">
            <p className="w-full text-sm">
              Erase <span className="t-figure">{eventCount}</span> events from this device? This
              cannot be undone.
            </p>
            <Button
              onClick={() => void erase()}
              loading={busy === 'erase'}
              className="border-danger text-danger"
            >
              Erase progress
            </Button>
            <Button variant="quiet" onClick={() => setConfirmErase(false)}>
              Keep it
            </Button>
          </div>
        ) : (
          <Button onClick={() => setConfirmErase(true)} disabled={!ready || eventCount === 0}>
            Erase progress
          </Button>
        )}
      </Row>

      <Row
        title="About"
        note="Share and adapt the lessons with credit, not for commercial use. The code is open source."
      >
        <p className="text-sm">
          © 2026. Lessons under{' '}
          <a
            href="https://creativecommons.org/licenses/by-nc-sa/4.0/"
            target="_blank"
            rel="noopener noreferrer license"
            className="underline underline-offset-4"
          >
            CC BY-NC-SA 4.0
            <span className="sr-only">(opens in a new tab)</span>
          </a>
          . Code under the MIT License.
        </p>
      </Row>

      <p
        role="status"
        className={
          notice?.tone === 'error'
            ? 'text-danger rule-t pt-2 text-sm'
            : 'text-muted rule-t pt-2 text-sm'
        }
      >
        {notice?.text ?? ''}
      </p>
    </div>
  );
}
