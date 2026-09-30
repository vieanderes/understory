import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InstallExplainer } from '@/features/pwa/InstallExplainer';
import { resetInstallStore } from '@/features/pwa/install-store';

/*
 * The "Install" row of Settings. The two browsers that matter behave differently: Safari
 * on iPhone and iPad has no install prompt at all, Chromium fires `beforeinstallprompt`.
 * Installing is what exempts the app from Safari's seven-day eviction, so the iOS path
 * has to be written out rather than hidden behind a button that will never appear.
 */

const CHROME =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';
const IPAD =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15';

function browser(userAgent: string, { touchPoints = 0, standalone = false } = {}): void {
  Object.defineProperty(window.navigator, 'userAgent', { value: userAgent, configurable: true });
  Object.defineProperty(window.navigator, 'maxTouchPoints', {
    value: touchPoints,
    configurable: true,
  });
  Object.defineProperty(window, 'matchMedia', {
    value: (query: string) => ({
      matches: standalone && query.includes('standalone'),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
    configurable: true,
  });
}

/** Chromium's event, which is not in the DOM lib. */
function offerInstall(prompt: () => Promise<{ outcome: 'accepted' | 'dismissed' }>): Event {
  const event = new Event('beforeinstallprompt', { cancelable: true });
  Object.assign(event, { prompt });
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
}

beforeEach(() => {
  resetInstallStore();
  browser(CHROME);
});

afterEach(() => {
  resetInstallStore();
});

describe('InstallExplainer on iOS Safari', () => {
  it('writes out the two steps of the Share sheet, because there is no prompt', () => {
    browser(IPHONE);
    render(<InstallExplainer />);
    const steps = screen.getAllByRole('listitem');
    expect(steps).toHaveLength(2);
    expect(steps[0]).toHaveTextContent('In Safari, press Share.');
    expect(steps[1]).toHaveTextContent('Choose Add to Home Screen.');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('recognises an iPad, which calls itself a Mac', () => {
    browser(IPAD, { touchPoints: 5 });
    render(<InstallExplainer />);
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('is not fooled by a Mac with a trackpad', () => {
    browser(IPAD, { touchPoints: 0 });
    render(<InstallExplainer />);
    expect(screen.queryByRole('listitem')).toBeNull();
  });
});

describe('InstallExplainer on Chromium', () => {
  it('points at the browser menu until the browser offers a prompt', () => {
    render(<InstallExplainer />);
    expect(screen.getByText(/Add to Home Screen command/)).toBeInTheDocument();
  });

  it('offers one button once the prompt is available, and keeps the infobar away', () => {
    render(<InstallExplainer />);
    const event = offerInstall(async () => ({ outcome: 'accepted' as const }));
    expect(event.defaultPrevented).toBe(true);
    expect(screen.getByRole('button', { name: 'Install Understory' })).toBeInTheDocument();
  });

  it('uses the prompt once, then stops offering it', async () => {
    const prompt = vi.fn(async () => ({ outcome: 'accepted' as const }));
    render(<InstallExplainer />);
    offerInstall(prompt);
    await userEvent.click(screen.getByRole('button', { name: 'Install Understory' }));
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Install Understory' })).toBeNull();
  });

  it('says the storage is safe once the app is installed', () => {
    browser(CHROME, { standalone: true });
    render(<InstallExplainer />);
    expect(
      screen.getByText('Installed. The browser keeps the storage of an installed app.'),
    ).toBeInTheDocument();
  });
});
