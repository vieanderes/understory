// A stand-in for window: it remembers which listeners are still attached.
function fakeTarget() {
  const listeners = new Set();
  return {
    listeners,
    addEventListener: (type, handler) => listeners.add(handler),
    removeEventListener: (type, handler) => listeners.delete(handler),
  };
}

// Swaps in timers that only record which intervals are still running.
function withFakeTimers(run) {
  const realSet = globalThis.setInterval;
  const realClear = globalThis.clearInterval;
  const running = new Set();
  let nextId = 1;
  globalThis.setInterval = () => {
    const id = nextId++;
    running.add(id);
    return id;
  };
  globalThis.clearInterval = (id) => running.delete(id);
  try {
    run(running);
  } finally {
    globalThis.setInterval = realSet;
    globalThis.clearInterval = realClear;
  }
}

test("starting the clock adds one listener and one timer", () => {
  withFakeTimers((running) => {
    const target = fakeTarget();
    startClock(target, () => {});
    expect(target.listeners.size).toBe(1);
    expect(running.size).toBe(1);
  });
});

test("stop removes the focus listener", () => {
  withFakeTimers(() => {
    const target = fakeTarget();
    const stop = startClock(target, () => {});
    stop();
    expect(target.listeners.size).toBe(0);
  });
});

test("stop clears the timer", () => {
  withFakeTimers((running) => {
    const stop = startClock(fakeTarget(), () => {});
    stop();
    expect(running.size).toBe(0);
  });
});

test("ten clocks started and stopped leave nothing behind", () => {
  withFakeTimers((running) => {
    const target = fakeTarget();
    for (let i = 0; i < 10; i++) startClock(target, () => {})();
    expect(target.listeners.size).toBe(0);
    expect(running.size).toBe(0);
  });
});

test("focus still shows the time while the clock runs", () => {
  withFakeTimers(() => {
    const target = fakeTarget();
    const shown = [];
    startClock(target, (text) => shown.push(text));
    for (const handler of target.listeners) handler();
    expect(shown).toHaveLength(1);
  });
});
