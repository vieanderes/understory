'use client';

import {
  Download,
  Headphones,
  LoaderCircle,
  Moon,
  Pause,
  Play,
  SkipBack,
  SkipForward,
} from 'lucide-react';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { buttonClass } from '@/components/ui/Button';
import {
  audiobookFileName,
  audioPath,
  scopeKey,
  type AudioPlaylist,
  type LectureScope,
} from '@/core/lecture';
import { cn } from '@/lib/cn';

/*
 * Listen to a lecture: the lesson, the chapter, the part, the course or a fast track, read by
 * a speech model at build time (scripts/build-audio.ts). A playlist runs lesson after lesson,
 * remembers where you stopped, runs from the lock screen, and can stop itself after a while
 * for listening in bed. Where no audio has been made yet, it says so and stays out of the way.
 */

const SPEEDS = [1, 1.25, 1.5, 1.75] as const;
const TIMERS = [0, 15, 30, 60] as const;

type Status = 'loading' | 'missing' | 'ready';

interface Place {
  index: number;
  time: number;
}

const placeKey = (scope: LectureScope) => `understory:audio:${scopeKey(scope)}`;

function readPlace(scope: LectureScope): Place {
  try {
    const raw = localStorage.getItem(placeKey(scope));
    if (!raw) return { index: 0, time: 0 };
    const place = JSON.parse(raw) as Place;
    return { index: Math.max(0, place.index | 0), time: Math.max(0, Number(place.time) || 0) };
  } catch {
    return { index: 0, time: 0 };
  }
}

function writePlace(scope: LectureScope, place: Place): void {
  try {
    localStorage.setItem(placeKey(scope), JSON.stringify(place));
  } catch {
    // Private windows refuse storage; the player still plays, it only forgets.
  }
}

const clock = (seconds: number): string => {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rest = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${rest}` : `${m}:${rest}`;
};

const megabytes = (bytes: number): string =>
  bytes >= 1e9 ? `${(bytes / 1e9).toFixed(1)} GB` : `${Math.max(1, Math.round(bytes / 1e6))} MB`;

const hoursAndMinutes = (seconds: number): string => {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
};

// The page's clock for the sleep timer, read without mirroring it in state from an effect.
const subscribeSecond = (tick: () => void) => {
  const id = window.setInterval(tick, 1000);
  return () => window.clearInterval(id);
};
const now = () => Math.floor(Date.now() / 1000);
const serverNow = () => 0;

export function AudioPlayer({ scope, label }: { scope: LectureScope; label: string }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [playlist, setPlaylist] = useState<AudioPlaylist | null>(null);
  const [index, setIndex] = useState(0);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [stopAt, setStopAt] = useState<number | null>(null);
  const resumeAt = useRef(0);
  const sleepTimer = useRef<number | undefined>(undefined);
  const second = useSyncExternalStore(subscribeSecond, now, serverNow);

  // Fetch the playlist once. Its absence is normal: audio is made after the pages.
  useEffect(() => {
    let cancelled = false;
    fetch(audioPath(scope))
      .then((response) => (response.ok ? (response.json() as Promise<AudioPlaylist>) : null))
      .then((found) => {
        if (cancelled) return;
        if (!found || found.items.length === 0) {
          setStatus('missing');
          return;
        }
        const place = readPlace(scope);
        const start = Math.min(place.index, found.items.length - 1);
        resumeAt.current = start === place.index ? place.time : 0;
        setPlaylist(found);
        setIndex(start);
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('missing');
      });
    return () => {
      cancelled = true;
    };
  }, [scope]);

  const item = playlist?.items[index];
  const total = playlist?.items.reduce((sum, entry) => sum + entry.seconds, 0) ?? 0;
  const remaining = stopAt === null ? null : stopAt - second;

  // Lock-screen and headphone controls.
  useEffect(() => {
    if (!item || !('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: item.title,
      artist: 'Understory',
      album: playlist?.title ?? label,
    });
    navigator.mediaSession.setActionHandler('play', () => void audio.current?.play());
    navigator.mediaSession.setActionHandler('pause', () => audio.current?.pause());
    navigator.mediaSession.setActionHandler('previoustrack', () => go(-1));
    navigator.mediaSession.setActionHandler('nexttrack', () => go(1));
  });

  function go(step: number) {
    if (!playlist) return;
    const next = index + step;
    if (next < 0 || next >= playlist.items.length) return;
    resumeAt.current = 0;
    setIndex(next);
    setTime(0);
    writePlace(scope, { index: next, time: 0 });
  }

  function toggle() {
    const element = audio.current;
    if (!element) return;
    if (element.paused) void element.play();
    else element.pause();
  }

  function cycleSpeed() {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length] ?? 1;
    setSpeed(next);
    if (audio.current) audio.current.playbackRate = next;
  }

  function cycleTimer() {
    const current = stopAt === null ? 0 : (TIMERS.find((m) => m * 60 >= (remaining ?? 0)) ?? 0);
    const next =
      TIMERS[(TIMERS.indexOf(current as (typeof TIMERS)[number]) + 1) % TIMERS.length] ?? 0;
    window.clearTimeout(sleepTimer.current);
    if (next === 0) {
      setStopAt(null);
      return;
    }
    setStopAt(now() + next * 60);
    // The pause is scheduled here, in the handler, so no effect has to watch the clock.
    sleepTimer.current = window.setTimeout(() => {
      audio.current?.pause();
      setStopAt(null);
    }, next * 60_000);
  }

  useEffect(() => () => window.clearTimeout(sleepTimer.current), []);

  if (status === 'loading') {
    return (
      <div
        className="lecture-screen-only t-label flex min-h-5 items-center gap-1"
        aria-live="polite"
      >
        <LoaderCircle aria-hidden size={16} strokeWidth={2} className="animate-spin" />
        Checking for audio
      </div>
    );
  }

  if (status === 'missing' || !playlist || !item) {
    return (
      <p className="lecture-screen-only text-muted flex items-center gap-1 text-sm">
        <Headphones aria-hidden size={16} strokeWidth={2} />
        The audio for this is still being made.
      </p>
    );
  }

  const many = playlist.items.length > 1;
  return (
    <section
      aria-label={`Listen: ${label}`}
      className="lecture-screen-only border-border rounded-panel flex flex-col gap-2 border p-2"
    >
      {/* Preload metadata only: a chapter of audio is tens of megabytes. */}
      <audio
        ref={audio}
        src={item.src}
        preload="metadata"
        onLoadedMetadata={(event) => {
          const element = event.currentTarget;
          element.playbackRate = speed;
          if (resumeAt.current > 0 && resumeAt.current < element.duration - 2) {
            element.currentTime = resumeAt.current;
          }
          resumeAt.current = 0;
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(event) => {
          const current = event.currentTarget.currentTime;
          setTime(current);
          if (Math.floor(current) % 5 === 0) writePlace(scope, { index, time: current });
        }}
        onEnded={() => {
          if (index + 1 < playlist.items.length) {
            go(1);
            // The next source plays once it loads; autoplay continues within the same gesture.
            window.setTimeout(() => void audio.current?.play(), 0);
          } else {
            writePlace(scope, { index: 0, time: 0 });
          }
        }}
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? 'Pause' : 'Play'}
          title={playing ? 'Pause' : 'Play'}
          className={buttonClass('secondary', 'md', 'size-5 shrink-0 px-0')}
        >
          {playing ? (
            <Pause aria-hidden size={16} strokeWidth={2} />
          ) : (
            <Play aria-hidden size={16} strokeWidth={2} />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{item.title}</p>
          <p className="t-label t-figure">
            {many ? `${index + 1} of ${playlist.items.length} · ` : ''}
            {clock(time)} / {clock(item.seconds)}
            {many ? ` · ${hoursAndMinutes(total)} in all` : ''}
          </p>
        </div>
      </div>
      <input
        type="range"
        min={0}
        max={item.seconds}
        step={1}
        value={Math.min(time, item.seconds)}
        aria-label="Position"
        aria-valuetext={`${clock(time)} of ${clock(item.seconds)}`}
        onChange={(event) => {
          const value = Number(event.currentTarget.value);
          if (audio.current) audio.current.currentTime = value;
          setTime(value);
        }}
        className="lecture-range w-full"
      />
      <div className="flex flex-wrap items-center gap-1">
        {many ? (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              disabled={index === 0}
              aria-label="Previous lesson"
              title="Previous lesson"
              className={buttonClass('quiet', 'md', 'size-5 px-0')}
            >
              <SkipBack aria-hidden size={16} strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              disabled={index + 1 >= playlist.items.length}
              aria-label="Next lesson"
              title="Next lesson"
              className={buttonClass('quiet', 'md', 'size-5 px-0')}
            >
              <SkipForward aria-hidden size={16} strokeWidth={2} />
            </button>
          </>
        ) : null}
        <button
          type="button"
          onClick={cycleSpeed}
          aria-label={`Speed ${speed} times. Change speed`}
          className={buttonClass('quiet', 'md', 't-figure')}
        >
          {speed}×
        </button>
        <button
          type="button"
          onClick={cycleTimer}
          aria-label={
            remaining === null
              ? 'Sleep timer off. Set a sleep timer'
              : `Sleep timer, ${clock(remaining)} left. Change it`
          }
          className={buttonClass('quiet', 'md', cn('t-figure', remaining !== null && 'text-fg'))}
        >
          <Moon aria-hidden size={16} strokeWidth={2} />
          {remaining === null ? 'Sleep timer' : clock(remaining)}
        </button>
        {playlist.book ? (
          <a
            href={playlist.book.src}
            download={audiobookFileName(label, playlist.book.src)}
            className={buttonClass('quiet', 'md', 't-figure')}
          >
            <Download aria-hidden size={16} strokeWidth={2} />
            {many ? 'Audiobook' : 'Audio'} · {megabytes(playlist.book.bytes)}
          </a>
        ) : null}
        {many ? (
          <label className="ml-auto flex min-w-0 items-center gap-1 text-sm">
            <span className="sr-only">Jump to</span>
            <select
              value={index}
              onChange={(event) => go(Number(event.currentTarget.value) - index)}
              className="border-border bg-surface rounded-control h-5 max-w-full min-w-0 border px-1 text-base sm:max-w-64"
            >
              {playlist.items.map((entry, i) => (
                <option key={`${i}-${entry.src}`} value={i}>
                  {String(i + 1).padStart(2, '0')} {entry.title}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
    </section>
  );
}
