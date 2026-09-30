'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { gsap, motionAllowed, SplitText } from './gsap';
import { DURATION, EASE } from './tokens';

/*
 * Arrival is choreographed (docs/MOTION.md). Anything marked `data-arrive` enters once:
 *
 *   title    lines rise out of a mask (use <Title>, never on a node React owns the text of)
 *   rise     fades in with a short lift
 *   stagger  its children rise one after another
 *   draw     a rule or line grows from the left
 *   weigh    its items (or its [data-weigh] items) settle from light into their weight
 *
 * CSS holds marked elements back from the first frame (globals.css), so nothing flashes.
 * What is on screen arrives as one timeline; what is below the fold arrives when it is
 * scrolled to, or when the part it sits in is opened. A page seen before in this visit
 * settles three times faster. Content that appears later (data loading) is picked up by a
 * MutationObserver.
 */

const PENDING = '[data-arrive]:not([data-arrived]):not([data-arrive-wait])';
const RISE = { autoAlpha: 0, y: 16 };
const CLEAR = 'opacity,visibility,transform';
/** The last element starts by then, so a whole arrival ends inside 1.2 s. */
const LAST_START = DURATION.arrive * 0.7;

const seen = new Set<string>();

function addTo(timeline: gsap.core.Timeline, el: HTMLElement, at: number): void {
  const kind = el.dataset.arrive;
  if (kind === 'title') {
    const split = SplitText.create(el, { type: 'lines', mask: 'lines' });
    timeline.from(
      split.lines,
      {
        yPercent: 110,
        stagger: DURATION.stagger * 1.5,
        // Put the original HTML back, unless React replaced the title meanwhile.
        onComplete: () => {
          if (split.lines[0]?.isConnected) split.revert();
        },
      },
      at,
    );
  } else if (kind === 'weigh') {
    // Everything starts light and faint, then each item takes the weight it has earned.
    const marked = el.querySelectorAll('[data-weigh]');
    const items = marked.length > 0 ? marked : el.children;
    timeline.from(
      items,
      {
        fontWeight: 400,
        opacity: 0.4,
        stagger: { amount: Math.min(items.length * DURATION.stagger, LAST_START) },
        clearProps: 'font-weight,opacity',
      },
      at,
    );
  } else if (kind === 'draw') {
    timeline.from(el, { scaleX: 0, transformOrigin: '0% 50%', clearProps: CLEAR }, at);
  } else if (kind === 'stagger') {
    timeline.from(el.children, { ...RISE, stagger: DURATION.stagger, clearProps: CLEAR }, at);
  } else {
    timeline.from(el, { ...RISE, clearProps: CLEAR }, at);
  }
}

function arrive(targets: HTMLElement[], timeScale: number): gsap.core.Timeline {
  const timeline = gsap.timeline({
    defaults: { duration: DURATION.arrive, ease: EASE.arrive.gsap },
  });
  targets.forEach((el, i) => addTo(timeline, el, Math.min(i * DURATION.stagger * 1.5, LAST_START)));
  return timeline.timeScale(timeScale);
}

export function Arrival() {
  const pathname = usePathname();

  useEffect(() => {
    const root = document.body;
    const quick = seen.has(pathname);
    seen.add(pathname);
    const timeScale = quick ? 3 : 1;
    const context = gsap.context(() => undefined);
    let frame = 0;
    let disposed = false;

    const below = new IntersectionObserver(
      (entries) => {
        const entering = entries.filter((e) => e.isIntersecting).map((e) => e.target);
        if (entering.length === 0) return;
        entering.forEach((el) => below.unobserve(el));
        context.add(() => {
          gsap.set(entering, { clearProps: CLEAR });
          arrive(entering as HTMLElement[], timeScale);
        });
      },
      { rootMargin: '0px 0px -10% 0px' },
    );

    const run = (): void => {
      frame = 0;
      const targets = [...root.querySelectorAll<HTMLElement>(PENDING)];
      if (targets.length === 0) return;
      targets.forEach((el) => el.setAttribute('data-arrived', ''));
      if (!motionAllowed()) return;
      const fold = window.innerHeight;
      // Something inside a closed part has no box yet. It waits, and arrives when opened.
      const onScreen = (el: HTMLElement): boolean => {
        const box = el.getBoundingClientRect();
        return box.height > 0 && box.top < fold;
      };
      const now = targets.filter(onScreen);
      const later = targets.filter((el) => !now.includes(el));
      context.add(() => {
        if (now.length > 0) arrive(now, timeScale);
        // Held in the risen-from state until scrolled to. A title below the fold just rises.
        if (later.length > 0) gsap.set(later, RISE);
      });
      later.forEach((el) => below.observe(el));
    };

    // Titles are split by rendered line, so wait for the display face.
    void document.fonts.ready.then(() => {
      if (!disposed) run();
    });
    const watcher = new MutationObserver(() => {
      if (frame === 0 && !disposed) frame = requestAnimationFrame(run);
    });
    watcher.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-arrive-wait'],
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      watcher.disconnect();
      below.disconnect();
      context.revert();
    };
  }, [pathname]);

  return null;
}
