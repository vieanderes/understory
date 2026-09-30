import type { DeviceKind } from '@/core/practice';

/** A touch screen or a narrow window gets no typing steps (LEARNING-SCIENCE.md B2). */
export function currentDevice(): DeviceKind {
  return window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768
    ? 'phone'
    : 'desktop';
}
