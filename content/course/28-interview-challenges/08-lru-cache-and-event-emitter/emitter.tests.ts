import { Emitter } from './emitter.solution';

test('emit passes the arguments and reports a listener ran', () => {
  const emitter = new Emitter();
  const seen: unknown[] = [];
  emitter.on('saved', (id, title) => seen.push(id, title));
  expect(emitter.emit('saved', 7, 'Notes')).toBe(true);
  expect(seen).toEqual([7, 'Notes']);
});

test('an event nobody listens to returns false', () => {
  const emitter = new Emitter();
  expect(emitter.emit('saved')).toBe(false);
  const stop = emitter.on('saved', () => {});
  stop();
  expect(emitter.emit('saved')).toBe(false);
});

test('listeners run in the order they were added', () => {
  const emitter = new Emitter();
  const order: string[] = [];
  emitter.on('saved', () => order.push('toast'));
  emitter.on('saved', () => order.push('badge'));
  emitter.emit('saved');
  expect(order).toEqual(['toast', 'badge']);
});

test('the function returned by on unsubscribes, and calling it twice is harmless', () => {
  const emitter = new Emitter();
  const calls: string[] = [];
  const keep = () => calls.push('keep');
  const stop = emitter.on('saved', () => calls.push('gone'));
  emitter.on('saved', keep);
  stop();
  stop();
  emitter.emit('saved');
  expect(calls).toEqual(['keep']);
});

test('off removes a listener, and an unknown one changes nothing', () => {
  const emitter = new Emitter();
  const calls: string[] = [];
  const toast = () => calls.push('toast');
  const badge = () => calls.push('badge');
  emitter.on('saved', toast);
  emitter.on('saved', badge);
  emitter.off('saved', () => {});
  emitter.off('saved', toast);
  emitter.emit('saved');
  expect(calls).toEqual(['badge']);
});

test('once runs a single time', () => {
  const emitter = new Emitter();
  let count = 0;
  emitter.once('saved', () => count++);
  emitter.emit('saved');
  emitter.emit('saved');
  expect(count).toBe(1);
});

test('off removes a once listener before it runs', () => {
  const emitter = new Emitter();
  let count = 0;
  const welcome = () => count++;
  emitter.once('saved', welcome);
  emitter.off('saved', welcome);
  expect(emitter.emit('saved')).toBe(false);
  expect(count).toBe(0);
});

test('a listener that removes itself does not make the next one skip', () => {
  const emitter = new Emitter();
  const calls: string[] = [];
  const toast = () => {
    emitter.off('saved', toast);
    calls.push('toast');
  };
  emitter.on('saved', toast);
  emitter.on('saved', () => calls.push('badge'));
  emitter.emit('saved');
  emitter.emit('saved');
  expect(calls).toEqual(['toast', 'badge', 'badge']);
});

test('once followed by on does not skip the second listener', () => {
  const emitter = new Emitter();
  const calls: string[] = [];
  emitter.once('saved', () => calls.push('first'));
  emitter.on('saved', () => calls.push('second'));
  emitter.emit('saved');
  expect(calls).toEqual(['first', 'second']);
});

test('events are kept apart', () => {
  const emitter = new Emitter();
  const calls: string[] = [];
  emitter.on('saved', () => calls.push('saved'));
  emitter.on('deleted', () => calls.push('deleted'));
  emitter.emit('deleted');
  expect(calls).toEqual(['deleted']);
});
