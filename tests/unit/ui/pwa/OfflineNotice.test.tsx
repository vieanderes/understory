import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { OfflineNotice } from '@/features/pwa/OfflineNotice';

function setOnline(value: boolean): void {
  Object.defineProperty(window.navigator, 'onLine', { value, configurable: true });
  act(() => {
    window.dispatchEvent(new Event(value ? 'online' : 'offline'));
  });
}

afterEach(() => {
  Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });
});

describe('OfflineNotice', () => {
  it('shows nothing while there is a network', () => {
    const { container } = render(<OfflineNotice />);
    expect(container).toBeEmptyDOMElement();
  });

  it('states the fact and reassures once the network goes', () => {
    render(<OfflineNotice />);
    setOnline(false);
    const notice = screen.getByRole('status');
    expect(notice).toHaveTextContent('Offline. Progress is saved on this device.');
  });

  it('goes away by itself when the network comes back', () => {
    Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true });
    const { container } = render(<OfflineNotice />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    setOnline(true);
    expect(container).toBeEmptyDOMElement();
  });
});
